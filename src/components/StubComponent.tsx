// Temporary stub component to bypass build errors from non-existent tables
import React from 'react';

export const StubComponent: React.FC<{ message?: string }> = ({ 
  message = "This feature will be available soon" 
}) => {
  return (
    <div className="p-4 text-muted-foreground text-center border border-dashed rounded-lg">
      {message}
    </div>
  );
};

// Stub function for non-existent table queries
export const stubQuery = () => {
  console.warn('Table not implemented yet');
  return Promise.resolve({ data: [], error: null });
};