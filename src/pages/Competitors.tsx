import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

const Competitors = () => {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Competitors</h1>
          <p className="text-muted-foreground">
            Manage competitor tracking and price monitoring
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Competitor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Competitor List</CardTitle>
          <CardDescription>
            Track prices from your key competitors
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">No competitors added yet</p>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Competitor
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Competitors;
