import { Outlet } from 'react-router-dom';
import ClientSidebar from '../shared/ClientSidebar';
import Header from './Header';
import RouteErrorBoundary from '../shared/RouteErrorBoundary';

/*
 * FE1 - Zaglavlje aplikacije | Developer: Marta Suljagic
 * 
 * MainLayout montira Header sa NotificationBell-om i navigacijom.
 * Header je fiksiran na vrhu (fixed top-0) sa z-40.
 * Main sadržaj ima padding-top pt-14 da ne bude prekriveno zaglavljem.
 */
export default function MainLayout() {
  return (
    <>
      <Header />
      <ClientSidebar />
      <main className="md:ml-64 min-h-screen bg-muted/40 pt-14">
        {/*
          Tailwind 4 ne pruža default `container` utility kao TW3.
          max-w-screen-2xl (1536px) daje više horizontalnog prostora ali
          zadržava lufta sa strane preko px-* utility-ja. NE koristimo
          mx-auto kombinaciju jer to centrira ispod 1536px viewport-a;
          ovde hocemo da content popuni dostupnu širinu.
        */}
        <div className="max-w-screen-2xl px-6 sm:px-8 lg:px-12 py-6">
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </div>
      </main>
    </>
  );
}
