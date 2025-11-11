import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const Recommendations = () => {
  // Mock recommendations data
  const recommendations = [
    {
      id: "1",
      sku: "SKU-001",
      productName: "Premium Coffee Beans",
      currentPrice: 24.99,
      recommendedPrice: 26.99,
      type: "increase_price",
      expectedMargin: 28.5,
      explanation: "Sales volume is high and you're significantly cheaper than competitors. Price increase won't hurt demand.",
    },
    {
      id: "2",
      sku: "SKU-002",
      productName: "Organic Tea Selection",
      currentPrice: 15.99,
      recommendedPrice: 14.49,
      type: "decrease_price",
      expectedMargin: 22.1,
      explanation: "You're more expensive than average competitor price and sales are declining. Lower price to regain market share.",
    },
    {
      id: "3",
      sku: "SKU-003",
      productName: "Specialty Chocolate",
      currentPrice: 8.99,
      recommendedPrice: 8.99,
      type: "keep_price",
      expectedMargin: 35.2,
      explanation: "Price is optimal. You're positioned well vs competitors and maintaining good margins with strong sales.",
    },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case "increase_price":
        return <TrendingUp className="h-4 w-4 text-success" />;
      case "decrease_price":
        return <TrendingDown className="h-4 w-4 text-warning" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (type) {
      case "increase_price":
        return "default";
      case "decrease_price":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI Recommendations</h1>
          <p className="text-muted-foreground">
            Intelligent pricing suggestions based on market analysis
          </p>
        </div>
        <Button>
          <RefreshCw className="h-4 w-4 mr-2" />
          Generate New Recommendations
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Price Increases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">1</div>
            <p className="text-xs text-muted-foreground">Products to increase</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Price Decreases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">1</div>
            <p className="text-xs text-muted-foreground">Products to decrease</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Keep Current</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">Optimal pricing</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pricing Recommendations</CardTitle>
          <CardDescription>
            Review and apply AI-generated pricing suggestions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Current Price</TableHead>
                  <TableHead className="text-right">Recommended</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">Expected Margin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recommendations.map((rec) => {
                  const priceChange = rec.recommendedPrice - rec.currentPrice;
                  const percentChange = (priceChange / rec.currentPrice * 100).toFixed(1);
                  
                  return (
                    <TableRow key={rec.id}>
                      <TableCell className="font-mono text-sm">{rec.sku}</TableCell>
                      <TableCell>
                        <div className="font-medium">{rec.productName}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {rec.explanation}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">€{rec.currentPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        €{rec.recommendedPrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {getIcon(rec.type)}
                          <span className={rec.type === "increase_price" ? "text-success" : rec.type === "decrease_price" ? "text-warning" : ""}>
                            {priceChange > 0 ? "+" : ""}{percentChange}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="default">{rec.expectedMargin}%</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getBadgeVariant(rec.type)}>
                          {rec.type.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="default">Accept</Button>
                          <Button size="sm" variant="outline">Reject</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Recommendations;
