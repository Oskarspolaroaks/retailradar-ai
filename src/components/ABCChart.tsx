import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchSalesDailyColumnsPaginated, fetchProductsPaginated } from "@/lib/supabasePaginate";
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
      // Fetch products with their ABC categories using pagination
      const products = await fetchProductsPaginated("id, abc_category, current_price", { status: "active" });

      if (!products) return;

      // Fetch sales data to calculate revenue per category with pagination
      const sales = await fetchSalesDailyColumnsPaginated(
        "product_id, selling_price, purchase_price, units_sold",
        {}
      );

      // Create a map of product revenue (calculated as selling_price - purchase_price)
      const revenueMap = new Map<string, number>();
      sales?.forEach((sale: any) => {
        const revenue = ((Number(sale.selling_price) || 0) - (Number(sale.purchase_price) || 0)) * (Number(sale.units_sold) || 0);
        const current = revenueMap.get(sale.product_id) || 0;
        revenueMap.set(sale.product_id, current + revenue);
      });

      // Aggregate by ABC category
      const categoryData = { A: { count: 0, revenue: 0 }, B: { count: 0, revenue: 0 }, C: { count: 0, revenue: 0 } };

      products.forEach((product) => {
        const category = product.abc_category as 'A' | 'B' | 'C' | null;
        if (category && categoryData[category]) {
          categoryData[category].count++;
          categoryData[category].revenue += revenueMap.get(product.id) || 0;
        }
      });

      const chartData: ABCData[] = [
        {
          name: "Category A",
          value: categoryData.A.count,
          revenue: categoryData.A.revenue,
          color: "hsl(var(--chart-1))",
        },
        {
          name: "Category B",
          value: categoryData.B.count,
          revenue: categoryData.B.revenue,
          color: "hsl(var(--chart-2))",
        },
        {
          name: "Category C",
          value: categoryData.C.count,
          revenue: categoryData.C.revenue,
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
