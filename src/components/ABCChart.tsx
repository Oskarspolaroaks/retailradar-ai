import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ABCData {
  name: string;
  value: number;
  revenue: number;
  color: string;
}

export const ABCChart = () => {
  const [abcData, setAbcData] = useState<ABCData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchABCData();
  }, []);

  const fetchABCData = async () => {
    try {
      // Get user's tenant
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: userTenant } = await supabase
        .from("user_tenants")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!userTenant) {
        setLoading(false);
        return;
      }

      // Calculate date from 90 days ago for revenue breakdown
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      const dateStr = startDate.toISOString().split('T')[0];

      // Use RPC functions for aggregated data (with tenant isolation)
      const [distributionResult, revenueResult] = await Promise.all([
        supabase.rpc('get_products_abc_distribution', { p_tenant_id: userTenant.tenant_id }),
        supabase.rpc('get_abc_revenue_breakdown', { p_tenant_id: userTenant.tenant_id, p_date_from: dateStr })
      ]);

      const distribution = distributionResult.data || [];
      const revenue = revenueResult.data || [];

      const chartData: ABCData[] = [
        {
          name: "Category A",
          value: Number(distribution.find((d: any) => d.abc_category === 'A')?.product_count || 0),
          revenue: Number(revenue.find((d: any) => d.abc_category === 'A')?.revenue || 0),
          color: "hsl(var(--chart-1))",
        },
        {
          name: "Category B",
          value: Number(distribution.find((d: any) => d.abc_category === 'B')?.product_count || 0),
          revenue: Number(revenue.find((d: any) => d.abc_category === 'B')?.revenue || 0),
          color: "hsl(var(--chart-2))",
        },
        {
          name: "Category C",
          value: Number(distribution.find((d: any) => d.abc_category === 'C')?.product_count || 0),
          revenue: Number(revenue.find((d: any) => d.abc_category === 'C')?.revenue || 0),
          color: "hsl(var(--chart-3))",
        },
      ];

      setAbcData(chartData);
    } catch (error) {
      console.error("Error fetching ABC data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>ABC Segmentation</CardTitle>
          <CardDescription>Product distribution by category</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ABC Segmentation</CardTitle>
        <CardDescription>Product distribution and revenue by category</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={abcData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value, percent }) => 
                `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {abcData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string, props: any) => [
                `${value} products`,
                `Revenue: €${props.payload.revenue.toFixed(2)}`,
              ]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
