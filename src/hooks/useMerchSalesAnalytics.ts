import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, startOfWeek, startOfMonth, subDays, format } from "date-fns";

export type TimeRange = 'today' | 'week' | 'month' | 'all';

export interface SalesAnalytics {
  totalRevenue: number;
  totalOrders: number;
  totalUnits: number;
  avgOrderValue: number;
  revenueByDay: { date: string; revenue: number; orders: number }[];
  salesByCountry: { country: string; revenue: number; orders: number; percentage: number }[];
  salesByChannel: { channel: string; revenue: number; count: number }[];
  salesByCustomerType: { type: string; revenue: number; count: number }[];
  topProducts: { id: string; name: string; type: string; units: number; revenue: number }[];
  gigSales: { gigId: string; venue: string; date: string; revenue: number; units: number }[];
}

const getStartDate = (range: TimeRange): Date | null => {
  const now = new Date();
  switch (range) {
    case 'today':
      return startOfDay(now);
    case 'week':
      return startOfWeek(now, { weekStartsOn: 1 });
    case 'month':
      return startOfMonth(now);
    case 'all':
      return null;
  }
};

export const useMerchSalesAnalytics = (bandId: string | null, timeRange: TimeRange = 'all') => {
  return useQuery({
    queryKey: ['merch-sales-analytics', bandId, timeRange],
    queryFn: async (): Promise<SalesAnalytics> => {
      if (!bandId) {
        return {
          totalRevenue: 0,
          totalOrders: 0,
          totalUnits: 0,
          avgOrderValue: 0,
          revenueByDay: [],
          salesByCountry: [],
          salesByChannel: [],
          salesByCustomerType: [],
          topProducts: [],
          gigSales: [],
        };
      }

      const startDate = getStartDate(timeRange);

      // Build the query
      let query = supabase
        .from('merch_orders')
        .select(`
          id,
          quantity,
          total_price,
          order_type,
          customer_type,
          country,
          city,
          gig_id,
          created_at,
          merchandise:player_merchandise(id, design_name, item_type)
        `)
        .eq('band_id', bandId)
        .order('created_at', { ascending: false });

      if (startDate) {
        query = query.gte('created_at', startDate.toISOString());
      }

      const { data: orders, error } = await query;

      if (error) throw error;

      if (!orders || orders.length === 0) {
        return {
          totalRevenue: 0,
          totalOrders: 0,
          totalUnits: 0,
          avgOrderValue: 0,
          revenueByDay: [],
          salesByCountry: [],
          salesByChannel: [],
          salesByCustomerType: [],
          topProducts: [],
          gigSales: [],
        };
      }

      // Calculate totals
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
      const totalOrders = orders.length;
      const totalUnits = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Revenue by day
      const revenueMap = new Map<string, { revenue: number; orders: number }>();
      orders.forEach(o => {
        const date = format(new Date(o.created_at), 'yyyy-MM-dd');
        const existing = revenueMap.get(date) || { revenue: 0, orders: 0 };
        revenueMap.set(date, {
          revenue: existing.revenue + (o.total_price || 0),
          orders: existing.orders + 1,
        });
      });
      const revenueByDay = Array.from(revenueMap.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Sales by country
      const countryMap = new Map<string, { revenue: number; orders: number }>();
      orders.forEach(o => {
        const country = o.country || 'Unknown';
        const existing = countryMap.get(country) || { revenue: 0, orders: 0 };
        countryMap.set(country, {
          revenue: existing.revenue + (o.total_price || 0),
          orders: existing.orders + 1,
        });
      });
      const salesByCountry = Array.from(countryMap.entries())
        .map(([country, stats]) => ({
          country,
          ...stats,
          percentage: totalRevenue > 0 ? (stats.revenue / totalRevenue) * 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Sales by channel
      const channelMap = new Map<string, { revenue: number; count: number }>();
      orders.forEach(o => {
        const channel = o.order_type || 'online';
        const existing = channelMap.get(channel) || { revenue: 0, count: 0 };
        channelMap.set(channel, {
          revenue: existing.revenue + (o.total_price || 0),
          count: existing.count + 1,
        });
      });
      const salesByChannel = Array.from(channelMap.entries())
        .map(([channel, stats]) => ({ channel, ...stats }))
        .sort((a, b) => b.revenue - a.revenue);

      // Sales by customer type
      const customerMap = new Map<string, { revenue: number; count: number }>();
      orders.forEach(o => {
        const type = o.customer_type || 'fan';
        const existing = customerMap.get(type) || { revenue: 0, count: 0 };
        customerMap.set(type, {
          revenue: existing.revenue + (o.total_price || 0),
          count: existing.count + 1,
        });
      });
      const salesByCustomerType = Array.from(customerMap.entries())
        .map(([type, stats]) => ({ type, ...stats }))
        .sort((a, b) => b.revenue - a.revenue);

      // Top products
      const productMap = new Map<string, { id: string; name: string; type: string; units: number; revenue: number }>();
      orders.forEach(o => {
        const merch = o.merchandise as any;
        if (!merch) return;
        const id = merch.id;
        const existing = productMap.get(id) || { 
          id, 
          name: merch.design_name || 'Unknown', 
          type: merch.item_type || 'Unknown',
          units: 0, 
          revenue: 0 
        };
        productMap.set(id, {
          ...existing,
          units: existing.units + (o.quantity || 0),
          revenue: existing.revenue + (o.total_price || 0),
        });
      });
      const topProducts = Array.from(productMap.values())
        .sort((a, b) => b.units - a.units)
        .slice(0, 10);

      // Gig sales
      const gigMap = new Map<string, { gigId: string; venue: string; date: string; revenue: number; units: number }>();
      orders.forEach(o => {
        if (!o.gig_id) return;
        const existing = gigMap.get(o.gig_id) || { 
          gigId: o.gig_id, 
          venue: 'Gig Venue', 
          date: format(new Date(o.created_at), 'MMM d, yyyy'),
          revenue: 0, 
          units: 0 
        };
        gigMap.set(o.gig_id, {
          ...existing,
          revenue: existing.revenue + (o.total_price || 0),
          units: existing.units + (o.quantity || 0),
        });
      });
      const gigSales = Array.from(gigMap.values())
        .sort((a, b) => b.revenue - a.revenue);

      return {
        totalRevenue,
        totalOrders,
        totalUnits,
        avgOrderValue,
        revenueByDay,
        salesByCountry,
        salesByChannel,
        salesByCustomerType,
        topProducts,
        gigSales,
      };
    },
    enabled: !!bandId,
    staleTime: 30 * 1000,
  });
};
