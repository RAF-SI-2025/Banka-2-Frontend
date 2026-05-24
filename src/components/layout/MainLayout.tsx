import { Outlet } from 'react-router-dom';
import ClientSidebar from '../shared/ClientSidebar';
import RouteErrorBoundary from '../shared/RouteErrorBoundary';
import Header from './Header';

export default function MainLayout() {
  return (
    <>
      <ClientSidebar />
      <Header />
      <main className="md:ml-64 min-h-screen bg-muted/40 pt-14">
        <div className="max-w-screen-2xl px-6 sm:px-8 lg:px-12 py-6">
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </div>
      </main>
    </>
  );
}
