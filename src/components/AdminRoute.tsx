import { ReactNode } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface AdminRouteProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'moderator' | 'user';
}

export const AdminRoute = ({ children, requiredRole = 'admin' }: AdminRouteProps) => {
  const { hasRole, loading } = useUserRole();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg font-oswald">Checking permissions...</p>
        </div>
      </div>
    );
  }

  if (!hasRole(requiredRole)) {
    return (
      <div className="min-h-screen bg-gradient-stage flex items-center justify-center p-6">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Access denied. You don't have permission to view this page.
            {requiredRole === 'admin' && ' Admin access required.'}
            {requiredRole === 'moderator' && ' Moderator access required.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <>{children}</>;
};