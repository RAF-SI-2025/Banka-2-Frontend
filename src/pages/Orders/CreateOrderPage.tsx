import * as Dialog from '@radix-ui/react-dialog';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CalendarClock,
  FilePlus2,
  Info,
  Loader2,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import VerificationModal from '@/components/shared/VerificationModal';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import { accountService } from '@/services/accountService';
import { currencyService } from '@/services/currencyService';
import exchangeManagementService from '@/services/exchangeManagementService';
import listingService from '@/services/listingService';
import marginService, { type MarginAccount } from '@/services/marginService';
import orderService from '@/services/orderService';
import { Permission } from '@/types';
import type { Account } from '@/types/celina2';
import { ListingType, OrderDirection, OrderType, type CreateOrderRequest, type Listing } from '@/types/celina3';
import { asArray, formatAmount, getErrorMessage } from '@/utils/formatters';

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  [OrderType.MARKET]: 'Market',
  [OrderType.LIMIT]: 'Limit',
  [OrderType.STOP]: 'Stop',
  [OrderType.STOP_LIMIT]: 'Stop-Limit',
};

const DIRECTION_LABELS: Record<OrderDirection, string> = {
  [OrderDirection.BUY]: 'Kupovina',
  [OrderDirection.SELL]: 'Prodaja',
};

const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  [ListingType.STOCK]: 'Akcija',
  [ListingType.FUTURES]: 'Futures',
  [ListingType.FOREX]: 'Forex',
};

const createOrderSchema = z
  .object({
    listingId: z.coerce.number().int().positive('Hartija je obavezna'),
    direction: z.enum([OrderDirection.BUY, OrderDirection.SELL]),
    quantity: z.coerce
      .number({ message: 'Količina mora biti broj' })
      .int('Količina mora biti ceo broj')
      .min(1, 'Količina mora biti najmanje 1'),
    orderType: z.enum([OrderType.MARKET, OrderType.LIMIT, OrderType.STOP, OrderType.STOP_LIMIT]),
    limitValue: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return undefined;
        const parsed = typeof value === 'number' ? value : Number(value);
        return Number.isNaN(parsed) ? value : parsed;
      },
      z
        .number({ message: 'Limit vrednost mora biti broj' })
        .positive('Limit vrednost mora biti veća od 0')
        .optional()
    ),
    stopValue: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return undefined;
        const parsed = typeof value === 'number' ? value : Number(value);
        return Number.isNaN(parsed) ? value : parsed;
      },
      z
        .number({ message: 'Stop vrednost mora biti broj' })
        .positive('Stop vrednost mora biti veća od 0')
        .optional()
    ),
    allOrNone: z.boolean(),
    margin: z.boolean(),
    accountId: z.preprocess(
      (value) => {
        if (value === '' || value === null || value === undefined) return undefined;
        const parsed = typeof value === 'number' ? value : Number(value);
        return Number.isNaN(parsed) ? value : parsed;
      },
      z.number().int().positive().optional()
    ),
  })
  .superRefine((data, ctx) => {
    if (
      (data.orderType === OrderType.LIMIT || data.orderType === OrderType.STOP_LIMIT) &&
      !data.limitValue
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['limitValue'],
        message: 'Limit vrednost je obavezna za izabrani tip ordera',
      });
    }

    if (
      (data.orderType === OrderType.STOP || data.orderType === OrderType.STOP_LIMIT) &&
      !data.stopValue
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['stopValue'],
        message: 'Stop vrednost je obavezna za izabrani tip ordera',
      });
    }
  });

type CreateOrderFormInput = z.input<typeof createOrderSchema>;
type CreateOrderFormValues = z.output<typeof createOrderSchema>;

function formatListingLabel(listing: Listing) {
  return `${listing.ticker} | ${listing.name} | ${listing.exchangeAcronym} | ${LISTING_TYPE_LABELS[listing.listingType]}`;
}

function formatAccountLabel(account: Account) {
  const accountName = account.name || account.ownerName || account.accountType;
  return `${accountName} | ${account.accountNumber} | ${formatAmount(account.availableBalance)} ${account.currency}`;
}

function getListingLabel(listing: Listing) {
  return `${listing.ticker} · ${listing.name}`;
}


function getPricePerUnit(
  listing: Listing | null,
  orderType: OrderType,
  direction: OrderDirection,
  limitValue?: number,
  _stopValue?: number
): number {
  if (!listing) return 0;

  const ask = Number(listing.ask ?? 0) || Number(listing.price ?? 0);
  const bid = Number(listing.bid ?? 0) || Number(listing.price ?? 0);

  if (orderType === OrderType.MARKET) {
    return direction === OrderDirection.BUY ? ask : bid;
  }

  if (orderType === OrderType.LIMIT) {
    return Number(limitValue ?? 0);
  }

  if (orderType === OrderType.STOP) {
    // STOP triggers at stopValue, then executes at market price (ask/bid)
    return direction === OrderDirection.BUY ? ask : bid;
  }

  // STOP_LIMIT: uses limit value as execution price
  return Number(limitValue ?? 0);
}

function getPriceSourceLabel(orderType: OrderType, direction: OrderDirection): string {
  if (orderType === OrderType.MARKET) {
    return direction === OrderDirection.BUY ? 'Ask cena' : 'Bid cena';
  }

  if (orderType === OrderType.LIMIT) return 'Limit vrednost';
  if (orderType === OrderType.STOP) return 'Stop vrednost';
  return 'Limit vrednost';
}

function getCommission(orderType: OrderType, approximatePrice: number, isEmployee: boolean = false): number {
  // Employees/actuaries trade from bank accounts — commission goes to bank (i.e. no net commission)
  if (isEmployee) return 0;
  if (approximatePrice <= 0) return 0;

  // Spec: Market/Stop → min(14% * price, $7), Limit/StopLimit → min(24% * price, $12)
  // "u zavisnosti od toga koji iznos je manji"
  const usesLimitPricing =
    orderType === OrderType.LIMIT || orderType === OrderType.STOP_LIMIT;
  const rate = usesLimitPricing ? 0.24 : 0.14;
  const cap = usesLimitPricing ? 12 : 7;

  return Math.min(approximatePrice * rate, cap);
}

function getDefaultCurrencyForListing(listing: Listing | null): string {
  if (!listing) return 'USD';

  const acronym = listing.exchangeAcronym.toUpperCase();

  if (listing.quoteCurrency) return listing.quoteCurrency;

  if (
    acronym.includes('NASDAQ') ||
    acronym.includes('NYSE') ||
    acronym.includes('AMEX') ||
    acronym.includes('ARCA') ||
    acronym.includes('CME')
  ) {
    return 'USD';
  }

  if (acronym.includes('LSE')) return 'GBP';
  if (acronym.includes('XETRA') || acronym.includes('EUREX')) return 'EUR';
  if (acronym.includes('BELEX')) return 'RSD';

  return 'USD';
}

function getPricingCurrency(listing: Listing | null): string {
  return getDefaultCurrencyForListing(listing);
}

function getListingTypesToLoad(isEmployee: boolean): ListingType[] {
  return isEmployee
    ? [ListingType.STOCK, ListingType.FUTURES, ListingType.FOREX]
    : [ListingType.STOCK, ListingType.FUTURES];
}

function buildCreateOrderPayload(
  data: CreateOrderFormValues,
  canUseMargin: boolean
): CreateOrderFormValues {
  return {
    ...data,
    limitValue:
      data.orderType === OrderType.LIMIT || data.orderType === OrderType.STOP_LIMIT
        ? data.limitValue
        : undefined,
    stopValue:
      data.orderType === OrderType.STOP || data.orderType === OrderType.STOP_LIMIT
        ? data.stopValue
        : undefined,
    margin: canUseMargin ? data.margin : false,
  };
}

export default function CreateOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { hasPermission, isAdmin, isSupervisor, isAgent, user } = useAuth();
  const isEmployeeRole = user?.role === 'ADMIN' || user?.role === 'EMPLOYEE';
  const isEmployeeUi = isAdmin || isSupervisor || isAgent || isEmployeeRole;

  const requestedListingIdParam = searchParams.get('listingId');
  const requestedListingId = requestedListingIdParam ? Number(requestedListingIdParam) : Number.NaN;
  const requestedDirection =
    searchParams.get('direction') === OrderDirection.SELL
      ? OrderDirection.SELL
      : OrderDirection.BUY;

  const [listings, setListings] = useState<Listing[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(true);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingOrder, setPendingOrder] = useState<CreateOrderFormValues | null>(null);
  const [exchangeApiOpen, setExchangeApiOpen] = useState<{ isOpen: boolean; name: string } | null>(null);
  const [exchangeApiLoading, setExchangeApiLoading] = useState(false);
  const [invalidListingRequested, setInvalidListingRequested] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [confirmedDto, setConfirmedDto] = useState<CreateOrderRequest | null>(null);
  const [marginAccounts, setMarginAccounts] = useState<MarginAccount[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [exchangeRateLoading, setExchangeRateLoading] = useState(false);

  const activeMargin = marginAccounts.find((m) => m.status === 'ACTIVE') ?? null;
  const canUseMargin = (isAdmin || hasPermission(Permission.TRADE_STOCKS)) && !!activeMargin;

  const {
    control,
    register,
    handleSubmit,
    setValue,
    reset,
    resetField,
    formState: { errors },
  } = useForm<CreateOrderFormInput, unknown, CreateOrderFormValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      listingId:
        Number.isFinite(requestedListingId) && requestedListingId > 0
          ? requestedListingId
          : undefined,
      direction: requestedDirection,
      quantity: 1,
      orderType: OrderType.MARKET,
      limitValue: undefined,
      stopValue: undefined,
      allOrNone: false,
      margin: false,
      accountId: undefined,
    },
  });

  const listingId = useWatch({ control, name: 'listingId' });
  const direction = useWatch({ control, name: 'direction' });
  const quantity = useWatch({ control, name: 'quantity' });
  const orderType = useWatch({ control, name: 'orderType' });
  const limitValue = useWatch({ control, name: 'limitValue' });
  const stopValue = useWatch({ control, name: 'stopValue' });
  const allOrNone = useWatch({ control, name: 'allOrNone' });
  const margin = useWatch({ control, name: 'margin' });
  const accountId = useWatch({ control, name: 'accountId' });

  const showLimitValue =
    orderType === OrderType.LIMIT || orderType === OrderType.STOP_LIMIT;
  const showStopValue =
    orderType === OrderType.STOP || orderType === OrderType.STOP_LIMIT;

  useEffect(() => {
    let mounted = true;

    const loadListings = async () => {
      setIsLoadingListings(true);

      try {
        const listingResponses = await Promise.all(
          getListingTypesToLoad(isEmployeeRole).map((type) =>
            listingService
              .getAll(type, '', 0, 100)
              .then((response) => asArray<Listing>(response.content))
              .catch(() => [])
          )
        );

        let nextListings = listingResponses.flat();

        if (
          requestedListingId > 0 &&
          !nextListings.some((listing) => listing.id === requestedListingId)
        ) {
          try {
            const listing = await listingService.getById(requestedListingId);
            nextListings = [listing, ...nextListings];
          } catch {
            if (mounted) setInvalidListingRequested(true);
          }
        }

        if (!mounted) return;

        const uniqueListings = nextListings
          .filter(
            (listing, index, array) =>
              array.findIndex((candidate) => candidate.id === listing.id) === index
          )
          .sort((left, right) => {
            if (left.ticker === right.ticker) {
              return left.name.localeCompare(right.name);
            }
            return left.ticker.localeCompare(right.ticker);
          });

        setListings(uniqueListings);
      } catch (error) {
        if (!mounted) return;

        setListings([]);
        setLoadError(getErrorMessage(error, 'Neuspešno učitavanje hartija za trgovinu.'));
      } finally {
        if (mounted) {
          setIsLoadingListings(false);
        }
      }
    };

    const loadAccounts = async () => {
      setIsLoadingAccounts(true);

      try {
        const nextAccounts = isEmployeeRole
          ? asArray<Account>((await accountService.getAll({ page: 0, limit: 100 })).content)
          : asArray<Account>(await accountService.getMyAccounts());

        if (!mounted) return;

        setAccounts(nextAccounts.filter((account) => account.status === 'ACTIVE'));
      } catch (error) {
        if (!mounted) return;

        setAccounts([]);
        setLoadError((current) =>
          current || getErrorMessage(error, 'Neuspešno učitavanje računa.')
        );
      } finally {
        if (mounted) {
          setIsLoadingAccounts(false);
        }
      }
    };

    void loadListings();
    void loadAccounts();

    return () => {
      mounted = false;
    };
  }, [isAdmin, isEmployeeRole, requestedListingId]);

  useEffect(() => {
    if (!listings.length) return;

    const currentListingId = Number(listingId);
    if (currentListingId && listings.some((listing) => listing.id === currentListingId)) return;

    setValue('listingId', listings[0].id, { shouldValidate: true });
  }, [listings, listingId, setValue]);

  useEffect(() => {
    if (!accounts.length) return;

    const currentAccountId = Number(accountId);
    if (currentAccountId && accounts.some((account) => account.id === currentAccountId)) return;

    setValue('accountId', accounts[0].id, { shouldValidate: true });
  }, [accounts, accountId, setValue]);

  useEffect(() => {
    if (!showLimitValue) {
      resetField('limitValue', { defaultValue: undefined });
    }
  }, [showLimitValue, resetField]);

  useEffect(() => {
    if (!showStopValue) {
      resetField('stopValue', { defaultValue: undefined });
    }
  }, [showStopValue, resetField]);

  useEffect(() => {
    if (!canUseMargin) {
      setValue('margin', false, { shouldValidate: true });
    }
  }, [canUseMargin, setValue]);

  // Fetch user's margin accounts (best-effort — ignore errors)
  useEffect(() => {
    let cancelled = false;
    marginService
      .getMyAccounts()
      .then((accts) => {
        if (!cancelled) setMarginAccounts(accts ?? []);
      })
      .catch(() => {
        if (!cancelled) setMarginAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch exchange open/closed status from API when listing changes
  useEffect(() => {
    const selectedListingObj = listings.find((l) => l.id === Number(listingId)) ?? null;
    if (!selectedListingObj?.exchangeAcronym) {
      setExchangeApiOpen(null);
      return;
    }

    let cancelled = false;
    setExchangeApiLoading(true);

    exchangeManagementService
      .getByAcronym(selectedListingObj.exchangeAcronym)
      .then((exchange) => {
        if (!cancelled) {
          setExchangeApiOpen({ isOpen: exchange.currentlyOpen ?? exchange.isCurrentlyOpen ?? exchange.isOpen ?? false, name: exchange.name });
        }
      })
      .catch(() => {
        // 404 or unavailable — don't show warning
        if (!cancelled) {
          setExchangeApiOpen(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setExchangeApiLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [listings, listingId]);

  const selectedListing = useMemo(
    () => listings.find((listing) => listing.id === Number(listingId)) ?? null,
    [listings, listingId]
  );

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === Number(accountId)) ?? null,
    [accounts, accountId]
  );

  // Fetch FX rate when listing currency differs from account currency
  const listingCurrencyForRate = useMemo(
    () => getPricingCurrency(selectedListing),
    [selectedListing]
  );
  const accountCurrencyForRate = selectedAccount?.currency ?? null;

  useEffect(() => {
    if (isEmployeeUi) {
      setExchangeRate(null);
      return;
    }
    if (!accountCurrencyForRate || !listingCurrencyForRate) {
      setExchangeRate(null);
      return;
    }
    if (listingCurrencyForRate === accountCurrencyForRate) {
      setExchangeRate(1);
      return;
    }

    let cancelled = false;
    setExchangeRateLoading(true);
    currencyService
      .convert({
        amount: 1,
        fromCurrency: listingCurrencyForRate,
        toCurrency: accountCurrencyForRate,
      })
      .then((result) => {
        if (!cancelled) {
          setExchangeRate(Number(result.exchangeRate) || null);
        }
      })
      .catch(() => {
        if (!cancelled) setExchangeRate(null);
      })
      .finally(() => {
        if (!cancelled) setExchangeRateLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isEmployeeUi, listingCurrencyForRate, accountCurrencyForRate]);

  const safeLimitValue =
    typeof limitValue === 'number' && Number.isFinite(limitValue) ? limitValue : undefined;

  const safeStopValue =
    typeof stopValue === 'number' && Number.isFinite(stopValue) ? stopValue : undefined;

  const safeQuantity =
    typeof quantity === 'number' && Number.isFinite(quantity) ? Math.max(quantity, 0) : 0;

  const contractSize = selectedListing?.contractSize ?? 1;
  const priceSourceLabel = getPriceSourceLabel(orderType, direction);
  const pricePerUnit = getPricePerUnit(
    selectedListing,
    orderType,
    direction,
    safeLimitValue,
    safeStopValue
  );

  const approximatePrice = contractSize * pricePerUnit * safeQuantity;
  const commission = getCommission(orderType, approximatePrice, isEmployeeRole);
  const totalAmount = approximatePrice + commission;
  const pricingCurrency = getPricingCurrency(selectedListing);

  // Settlement date warnings for FUTURES
  const settlementInfo = useMemo(() => {
    if (!selectedListing || selectedListing.listingType !== ListingType.FUTURES || !selectedListing.settlementDate) {
      return null;
    }
    const settlement = new Date(selectedListing.settlementDate);
    const now = new Date();
    const diffMs = settlement.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isPast = diffDays < 0;
    const isWithin7Days = diffDays >= 0 && diffDays <= 7;
    const formattedDate = settlement.toLocaleDateString('sr-RS');
    return { isPast, isWithin7Days, diffDays, formattedDate };
  }, [selectedListing]);

  const settlementBlocksSubmit = settlementInfo?.isPast === true;

  const canCompareBalance = Boolean(
    selectedAccount?.currency && selectedAccount.currency === pricingCurrency
  );

  // Approximate price converted to account currency (for dual-currency display)
  const approximatePriceInAccount =
    exchangeRate && Number.isFinite(exchangeRate) ? approximatePrice * exchangeRate : approximatePrice;

  const insufficientFunds =
    !isEmployeeUi &&
    canCompareBalance &&
    totalAmount > Number(selectedAccount?.availableBalance ?? 0);

  const confirmationListing = useMemo(
    () =>
      pendingOrder
        ? listings.find((listing) => listing.id === pendingOrder.listingId) ?? null
        : null,
    [listings, pendingOrder]
  );

  const confirmationAccount = useMemo(
    () =>
      pendingOrder
        ? accounts.find((account) => account.id === pendingOrder.accountId) ?? null
        : null,
    [accounts, pendingOrder]
  );

  const confirmationContractSize = confirmationListing?.contractSize ?? 1;
  const confirmationPricePerUnit = pendingOrder
    ? getPricePerUnit(
        confirmationListing,
        pendingOrder.orderType,
        pendingOrder.direction,
        pendingOrder.limitValue,
        pendingOrder.stopValue
      )
    : 0;

  const confirmationApproximatePrice = pendingOrder
    ? confirmationContractSize * confirmationPricePerUnit * pendingOrder.quantity
    : 0;

  const confirmationCommission = pendingOrder
    ? getCommission(pendingOrder.orderType, confirmationApproximatePrice, isEmployeeRole)
    : 0;

  const confirmationTotal = confirmationApproximatePrice + confirmationCommission;
  const confirmationCurrency = getPricingCurrency(confirmationListing);

  const isLoading = isLoadingListings || isLoadingAccounts;
  const isEmpty = !isLoading && (listings.length === 0 || accounts.length === 0);

  const openConfirmation = (data: CreateOrderFormValues) => {
    const nextOrder = buildCreateOrderPayload(data, canUseMargin);

    if (settlementBlocksSubmit) {
      toast.error('Datum dospeća za ovaj futures ugovor je prošao. Nalog nije moguće kreirati.');
      return;
    }

    if (!isEmployeeUi && !nextOrder.accountId) {
      toast.error('Račun je obavezan.');
      return;
    }

    if (insufficientFunds) {
      toast.error('Procena ukupnog troška prelazi raspoloživo stanje izabranog računa.');
      return;
    }

    setPendingOrder(nextOrder);
    setIsConfirmOpen(true);
  };

  // Step 1: user clicks "Potvrdi" in the confirmation dialog -> build DTO, open OTP modal
  const handleConfirmOrder = () => {
    if (!pendingOrder) return;

    const dto: CreateOrderRequest = {
      listingId: pendingOrder.listingId,
      orderType: pendingOrder.orderType,
      quantity: pendingOrder.quantity,
      contractSize: confirmationContractSize,
      direction: pendingOrder.direction,
      limitValue: pendingOrder.limitValue,
      stopValue: pendingOrder.stopValue,
      allOrNone: pendingOrder.allOrNone,
      margin: pendingOrder.margin,
      // Employees: omit accountId; backend uses bank trading account
      ...(isEmployeeUi ? {} : { accountId: pendingOrder.accountId }),
    };

    setConfirmedDto(dto);
    setIsConfirmOpen(false);
    setShowVerification(true);
  };

  // Step 2: OTP verified -> actually POST /orders with otpCode
  const handleOtpVerified = async (otpCode: string) => {
    if (!confirmedDto) throw new Error('Nedostaju podaci naloga.');

    try {
      await orderService.create({ ...confirmedDto, otpCode });

      toast.success('Nalog je uspešno kreiran.');

      setShowVerification(false);
      setConfirmedDto(null);
      setPendingOrder(null);

      reset({
        listingId: selectedListing?.id ?? listings[0]?.id ?? undefined,
        direction,
        quantity: 1,
        orderType: OrderType.MARKET,
        limitValue: undefined,
        stopValue: undefined,
        allOrNone: false,
        margin: false,
        accountId: selectedAccount?.id ?? accounts[0]?.id ?? undefined,
      });

      navigate('/orders/my');
    } catch (error) {
      // Re-throw so VerificationModal tracks attempts and displays message
      throw error;
    }
  };

  return (
    <>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20">
            <FilePlus2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Novi nalog</h1>
            <p className="text-sm text-muted-foreground">
              Kreirajte BUY ili SELL nalog i proverite procenu troskova pre slanja
            </p>
          </div>
        </div>

        {loadError && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Greška pri učitavanju</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {invalidListingRequested && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Hartija ne postoji</AlertTitle>
            <AlertDescription>
              Tražena hartija (ID: {requestedListingIdParam}) nije pronađena. Možete izabrati drugu hartiju iz liste ispod.
            </AlertDescription>
          </Alert>
        )}

        {isLoading ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card>
              <CardHeader className="space-y-3">
                <div className="h-6 w-40 animate-pulse rounded bg-muted" />
                <div className="h-4 w-72 animate-pulse rounded bg-muted/70" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <div className="h-4 w-28 animate-pulse rounded bg-muted/70" />
                    <div className="h-10 w-full animate-pulse rounded bg-muted" />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="space-y-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <Card key={index}>
                  <CardHeader className="space-y-3">
                    <div className="h-5 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-52 animate-pulse rounded bg-muted/70" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Array.from({ length: 4 }).map((__, row) => (
                      <div key={row} className="h-4 w-full animate-pulse rounded bg-muted/70" />
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : isEmpty ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                {accounts.length === 0 ? (
                  <Wallet className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <FilePlus2 className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
              <h2 className="text-lg font-semibold">
                {accounts.length === 0 ? 'Nema dostupnih računa' : 'Nema dostupnih hartija'}
              </h2>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                {accounts.length === 0
                  ? 'Za kreiranje naloga potreban je barem jedan aktivan račun.'
                  : 'Trenutno nema hartija dostupnih za trgovinu. Pokušajte ponovo kasnije.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Podaci naloga</CardTitle>
                <CardDescription>
                  Unesite parametre naloga i otvorite potvrdu pre slanja.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form className="space-y-6" onSubmit={handleSubmit(openConfirmation)} noValidate>
                  <div className="space-y-2">
                    <Label htmlFor="listingId">Hartija</Label>
                    <select
                      id="listingId"
                      className={selectClassName}
                      aria-invalid={Boolean(errors.listingId)}
                      {...register('listingId')}
                    >
                      <option value="">Izaberite hartiju</option>
                      {listings.map((listing) => (
                        <option key={listing.id} value={listing.id}>
                          {formatListingLabel(listing)}
                        </option>
                      ))}
                    </select>
                    {errors.listingId && (
                      <p className="text-sm text-destructive">{errors.listingId.message}</p>
                    )}
                  </div>

                  <fieldset className="space-y-3">
                    <legend className="text-sm font-medium">Smer</legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {Object.values(OrderDirection).map((option) => {
                        const isBuy = option === OrderDirection.BUY;
                        const isSelected = direction === option;
                        return (
                          <label
                            key={option}
                            className={cn(
                              'flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm font-medium transition-all',
                              isSelected && isBuy && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 shadow-sm',
                              isSelected && !isBuy && 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 shadow-sm',
                              !isSelected && 'border-input hover:border-muted-foreground/50'
                            )}
                          >
                            <input type="radio" value={option} {...register('direction')} className="sr-only" />
                            {isBuy ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                            <span>{DIRECTION_LABELS[option]}</span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Količina</Label>
                      <Controller
                        control={control}
                        name="quantity"
                        render={({ field }) => (
                          <Input
                            id="quantity"
                            type="number"
                            min={1}
                            step={1}
                            aria-invalid={Boolean(errors.quantity)}
                            value={field.value != null ? String(field.value) : ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value === '' ? undefined : Number(value));
                            }}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        )}
                      />
                      {errors.quantity && (
                        <p className="text-sm text-destructive">{errors.quantity.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="orderType">Tip ordera</Label>
                      <select
                        id="orderType"
                        className={selectClassName}
                        {...register('orderType')}
                      >
                        {Object.values(OrderType).map((option) => (
                          <option key={option} value={option}>
                            {ORDER_TYPE_LABELS[option]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {showLimitValue && (
                    <div className="space-y-2">
                      <Label htmlFor="limitValue">Limit vrednost</Label>
                      <Controller
                        control={control}
                        name="limitValue"
                        render={({ field }) => (
                          <Input
                            id="limitValue"
                            type="number"
                            min={0}
                            step="0.01"
                            aria-invalid={Boolean(errors.limitValue)}
                            value={field.value != null ? String(field.value) : ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value === '' ? undefined : Number(value));
                            }}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        )}
                      />
                      {errors.limitValue && (
                        <p className="text-sm text-destructive">{errors.limitValue.message}</p>
                      )}
                    </div>
                  )}

                  {showStopValue && (
                    <div className="space-y-2">
                      <Label htmlFor="stopValue">Stop vrednost</Label>
                      <Controller
                        control={control}
                        name="stopValue"
                        render={({ field }) => (
                          <Input
                            id="stopValue"
                            type="number"
                            min={0}
                            step="0.01"
                            aria-invalid={Boolean(errors.stopValue)}
                            value={field.value != null ? String(field.value) : ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value === '' ? undefined : Number(value));
                            }}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                        )}
                      />
                      {errors.stopValue && (
                        <p className="text-sm text-destructive">{errors.stopValue.message}</p>
                      )}
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex items-start gap-3 rounded-md border border-input p-4 text-sm">
                      <input type="checkbox" className="mt-1" {...register('allOrNone')} />
                      <div>
                        <p className="font-medium">All or None</p>
                        <p className="text-muted-foreground">
                          {allOrNone
                            ? 'Nalog se izvršava samo ako može u potpunosti.'
                            : 'Dozvoljeno je parcijalno izvršenje.'}
                        </p>
                      </div>
                    </label>

                    <label
                      className={cn(
                        'flex items-start gap-3 rounded-md border border-input p-4 text-sm',
                        !activeMargin && 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        disabled={!activeMargin}
                        {...register('margin')}
                      />
                      <div>
                        <p className="font-medium">Margin order</p>
                        <p className="text-muted-foreground">
                          {!activeMargin
                            ? 'Nemate aktivan margin račun.'
                            : margin
                            ? `Margin uključen (${activeMargin.currency}).`
                            : 'Margin je dostupan, ali trenutno nije uključen.'}
                        </p>
                      </div>
                    </label>
                  </div>

                  {isEmployeeUi ? (
                    <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/40">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Trguje se sa bankinog računa</AlertTitle>
                      <AlertDescription>
                        Nalog će koristiti bankin trading račun u valuti hartije
                        {selectedListing ? ` (${pricingCurrency})` : ''}. Provizija za zaposlene je 0.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="accountId">Račun</Label>
                      <select
                        id="accountId"
                        className={selectClassName}
                        aria-invalid={Boolean(errors.accountId)}
                        {...register('accountId')}
                      >
                        <option value="">Izaberite račun</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {formatAccountLabel(account)}
                          </option>
                        ))}
                      </select>
                      {errors.accountId && (
                        <p className="text-sm text-destructive">{errors.accountId.message}</p>
                      )}
                    </div>
                  )}

                  {!isEmployeeUi && selectedAccount && (
                    <div className="rounded-md border bg-muted/40 p-4 text-sm">
                      <p className="font-medium">
                        Raspoloživo stanje: {formatAmount(selectedAccount.availableBalance)}{' '}
                        {selectedAccount.currency}
                      </p>
                      <p className="mt-1 text-muted-foreground">{selectedAccount.accountNumber.slice(-4)}</p>
                    </div>
                  )}

                  {/* Commission preview */}
                  {selectedListing && safeQuantity > 0 && (
                    <div className="rounded-md border bg-muted/30 p-4 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          Približna cena ({pricingCurrency})
                        </span>
                        <span className="font-mono font-medium">
                          {formatAmount(approximatePrice)} {pricingCurrency}
                        </span>
                      </div>
                      {!isEmployeeUi &&
                        selectedAccount &&
                        selectedAccount.currency !== pricingCurrency &&
                        exchangeRate &&
                        exchangeRate !== 1 && (
                          <>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Kurs</span>
                              <span className="font-mono font-medium">
                                1 {pricingCurrency} = {exchangeRate.toFixed(4)}{' '}
                                {selectedAccount.currency}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">
                                Približna cena ({selectedAccount.currency})
                              </span>
                              <span className="font-mono font-medium">
                                {formatAmount(approximatePriceInAccount)} {selectedAccount.currency}
                              </span>
                            </div>
                          </>
                        )}
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Provizija</span>
                        <span className="font-mono font-medium">
                          {isEmployeeUi
                            ? '0 (zaposleni)'
                            : `${formatAmount(commission)} ${pricingCurrency}`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t pt-2">
                        <span className="font-medium">Ukupno sa provizijom</span>
                        <span className="font-mono font-semibold">
                          {formatAmount(totalAmount)} {pricingCurrency}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Exchange API: after-hours warning */}
                  {!exchangeApiLoading && exchangeApiOpen && !exchangeApiOpen.isOpen && (
                    <Alert variant="warning">
                      <TriangleAlert className="h-4 w-4" />
                      <AlertTitle>Berza zatvorena</AlertTitle>
                      <AlertDescription>
                        Berza {exchangeApiOpen.name} je trenutno zatvorena. Order ce biti kreiran, ali ce se izvrsavati sporije
                        — svaki deo naloga ce zahtevati dodatno vreme za ispunjenje (npr. +30 min po delu).
                        Izvrsenje ce poceti kada se berza otvori.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Settlement date warnings for Futures */}
                  {settlementInfo?.isPast && (
                    <Alert variant="destructive">
                      <CalendarClock className="h-4 w-4" />
                      <AlertTitle>Datum dospeca je prosao</AlertTitle>
                      <AlertDescription>
                        Datum dospeca za ovaj futures ugovor ({settlementInfo.formattedDate}) je prosao. Nije moguce kreirati nalog.
                      </AlertDescription>
                    </Alert>
                  )}

                  {settlementInfo?.isWithin7Days && !settlementInfo.isPast && (
                    <Alert variant="warning">
                      <CalendarClock className="h-4 w-4" />
                      <AlertTitle>Datum dospeca se priblizava</AlertTitle>
                      <AlertDescription>
                        Datum dospeca za ovaj futures ugovor je {settlementInfo.formattedDate} (jos {settlementInfo.diffDays} dana). Razmotrite rizike pre kreiranja naloga.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={settlementBlocksSubmit}
                      className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                    >
                      Nastavi na potvrdu
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-6">
              {!exchangeApiLoading && exchangeApiOpen && !exchangeApiOpen.isOpen && (
                <Alert variant="warning">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>Berza je trenutno zatvorena</AlertTitle>
                  <AlertDescription>
                    Izvršenje naloga će čekati sledeći trgovinski prozor za{' '}
                    {exchangeApiOpen.name || selectedListing?.exchangeAcronym || 'izabranu berzu'}.
                    Svaki deo naloga će se izvršavati uz dodatno čekanje od ~30 minuta.
                  </AlertDescription>
                </Alert>
              )}

              {insufficientFunds && (
                <Alert variant="destructive">
                  <TriangleAlert className="h-4 w-4" />
                  <AlertTitle>Nedovoljno sredstava</AlertTitle>
                  <AlertDescription>
                    Procena ukupnog troška prelazi raspoloživo stanje izabranog računa.
                  </AlertDescription>
                </Alert>
              )}

              {selectedListing && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Izabrana hartija</CardTitle>
                    <CardDescription>{getListingLabel(selectedListing)}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Tip</span>
                      <span className="font-medium">
                        {LISTING_TYPE_LABELS[selectedListing.listingType]}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Berza</span>
                      <span className="font-medium">{selectedListing.exchangeAcronym}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cena</span>
                      <span className="font-medium">{formatAmount(selectedListing.price)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ask / Bid</span>
                      <span className="font-medium">
                        {formatAmount(selectedListing.ask)} / {formatAmount(selectedListing.bid)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Contract size</span>
                      <span className="font-medium">{formatAmount(contractSize, 0)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card data-testid="cost-estimate-card">
                <CardHeader>
                  <CardTitle className="text-lg">Procena troškova</CardTitle>
                  <CardDescription>
                    Informativni obračun zasnovan na trenutnim podacima.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between" data-testid="direction-row">
                    <span className="text-muted-foreground">Smer</span>
                    <span className="font-medium">{DIRECTION_LABELS[direction]}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="order-type-row">
                    <span className="text-muted-foreground">Tip ordera</span>
                    <span className="font-medium">{ORDER_TYPE_LABELS[orderType]}</span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="price-source-row">
                    <span className="text-muted-foreground">{priceSourceLabel}</span>
                    <span className="font-medium">
                      {formatAmount(pricePerUnit)} {pricingCurrency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between" data-testid="quantity-row">
                    <span className="text-muted-foreground">Količina</span>
                    <span className="font-medium">{formatAmount(safeQuantity, 0)}</span>
                  </div>
                  <div
                    className="flex items-center justify-between"
                    data-testid="approximate-price-row"
                  >
                    <span className="text-muted-foreground">Približna cena</span>
                    <span className="font-medium">
                      {formatAmount(approximatePrice)} {pricingCurrency}
                    </span>
                  </div>
                  {!isEmployeeUi &&
                    selectedAccount &&
                    selectedAccount.currency !== pricingCurrency &&
                    exchangeRate &&
                    exchangeRate !== 1 && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Kurs</span>
                          <span className="font-medium">
                            1 {pricingCurrency} = {exchangeRate.toFixed(4)} {selectedAccount.currency}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Približna cena ({selectedAccount.currency})
                          </span>
                          <span className="font-medium">
                            {formatAmount(approximatePriceInAccount)} {selectedAccount.currency}
                          </span>
                        </div>
                      </>
                    )}
                  {exchangeRateLoading && (
                    <div className="text-xs text-muted-foreground">Učitavanje kursa...</div>
                  )}
                  <div className="flex items-center justify-between" data-testid="commission-row">
                    <span className="text-muted-foreground">Provizija</span>
                    <span className="font-medium">
                      {isEmployeeUi ? '0 (zaposleni)' : `${formatAmount(commission)} ${pricingCurrency}`}
                    </span>
                  </div>
                  <div className="rounded-md bg-muted/50 px-4 py-3" data-testid="total-row">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Ukupno</span>
                      <span className="text-base font-semibold">
                        {formatAmount(totalAmount)} {pricingCurrency}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                    Market i Stop nalozi koriste proviziju min(14%, 7), a Limit i Stop-Limit
                    min(24%, 12).
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Kontrole izvršenja</CardTitle>
                  <CardDescription>Pregled dodatnih opcija za nalog.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start gap-3 rounded-md border p-4">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium">All or None</p>
                      <p className="text-muted-foreground">
                        {allOrNone
                          ? 'Nalog se izvršava samo ako može u potpunosti.'
                          : 'Dozvoljeno je parcijalno izvršenje.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-md border p-4">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium">Margin</p>
                      <p className="text-muted-foreground">
                        {canUseMargin
                          ? margin
                            ? 'Margin je uključen za ovaj nalog.'
                            : 'Margin je dostupan, ali trenutno nije uključen.'
                          : 'Margin nije dostupan za vaš nalog.'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      <Dialog.Root
        open={isConfirmOpen}
        onOpenChange={(open) => {
          setIsConfirmOpen(open);
          if (!open && !isSubmitting) {
            setPendingOrder(null);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background shadow-2xl">
            <div className="flex items-start justify-between border-b p-6">
              <div>
                <Dialog.Title className="text-xl font-semibold">Potvrda naloga</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  Proverite detalje pre slanja ordera na obradu.
                </Dialog.Description>
              </div>

              <Dialog.Close asChild>
                <button
                  type="button"
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label="Zatvori"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            <div className="space-y-4 p-6">
              <div className="rounded-md border p-4 text-sm">
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Hartija</span>
                  <span className="font-medium">
                    {confirmationListing ? getListingLabel(confirmationListing) : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Smer</span>
                  <span className="font-medium">
                    {pendingOrder ? DIRECTION_LABELS[pendingOrder.direction] : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Tip ordera</span>
                  <span className="font-medium">
                    {pendingOrder ? ORDER_TYPE_LABELS[pendingOrder.orderType] : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Količina</span>
                  <span className="font-medium">
                    {pendingOrder ? formatAmount(pendingOrder.quantity, 0) : '-'}
                  </span>
                </div>

                {pendingOrder?.limitValue && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Limit vrednost</span>
                    <span className="font-medium">
                      {formatAmount(pendingOrder.limitValue)} {confirmationCurrency}
                    </span>
                  </div>
                )}

                {pendingOrder?.stopValue && (
                  <div className="flex items-center justify-between py-1">
                    <span className="text-muted-foreground">Stop vrednost</span>
                    <span className="font-medium">
                      {formatAmount(pendingOrder.stopValue)} {confirmationCurrency}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">All or None</span>
                  <span className="font-medium">{pendingOrder?.allOrNone ? 'Da' : 'Ne'}</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Margin</span>
                  <span className="font-medium">{pendingOrder?.margin ? 'Da' : 'Ne'}</span>
                </div>

                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Račun</span>
                  <span className="font-medium">
                    {isEmployeeUi
                      ? 'Bankin trading račun'
                      : confirmationAccount?.accountNumber.slice(-4) || '-'}
                  </span>
                </div>
              </div>

              <div className="rounded-md bg-muted/50 p-4 text-sm">
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Cena po jedinici</span>
                  <span className="font-medium">
                    {formatAmount(confirmationPricePerUnit)} {confirmationCurrency}
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Contract size</span>
                  <span className="font-medium">{formatAmount(confirmationContractSize, 0)}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Približna cena</span>
                  <span className="font-medium">
                    {formatAmount(confirmationApproximatePrice)} {confirmationCurrency}
                  </span>
                </div>
                {!isEmployeeUi &&
                  confirmationAccount &&
                  confirmationAccount.currency !== confirmationCurrency &&
                  exchangeRate &&
                  exchangeRate !== 1 && (
                    <>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-muted-foreground">Kurs</span>
                        <span className="font-medium">
                          1 {confirmationCurrency} = {exchangeRate.toFixed(4)}{' '}
                          {confirmationAccount.currency}
                        </span>
                      </div>
                      <div className="flex items-center justify-between py-1">
                        <span className="text-muted-foreground">
                          Približna cena ({confirmationAccount.currency})
                        </span>
                        <span className="font-medium">
                          {formatAmount(confirmationApproximatePrice * exchangeRate)}{' '}
                          {confirmationAccount.currency}
                        </span>
                      </div>
                    </>
                  )}
                <div className="flex items-center justify-between py-1">
                  <span className="text-muted-foreground">Provizija</span>
                  <span className="font-medium">
                    {isEmployeeUi
                      ? '0 (zaposleni)'
                      : `${formatAmount(confirmationCommission)} ${confirmationCurrency}`}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t pt-3">
                  <span className="font-medium">Ukupno</span>
                  <span className="text-base font-semibold">
                    {formatAmount(confirmationTotal)} {confirmationCurrency}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button type="button" variant="outline" disabled={isSubmitting}>
                    Odustani
                  </Button>
                </Dialog.Close>

                <Button
                  type="button"
                  data-cy="confirm-order"
                  onClick={handleConfirmOrder}
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Slanje...
                    </>
                  ) : (
                    'Potvrdi'
                  )}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <VerificationModal
        isOpen={showVerification}
        onClose={() => {
          setShowVerification(false);
          setConfirmedDto(null);
        }}
        onVerified={handleOtpVerified}
      />
    </>
  );
}