import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Zap } from "lucide-react";

interface ABCSettings {
  id: string;
  analysis_period_days: number;
  threshold_a_percent: number;
  threshold_b_percent: number;
  threshold_c_percent: number;
  last_calculated_at: string | null;
}

const Settings = () => {
  const { toast } = useToast();
  const [abcSettings, setAbcSettings] = useState<ABCSettings | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetchABCSettings();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      setIsAdmin(roles?.role === "admin");
    }
  };

  const fetchABCSettings = async () => {
    const { data, error } = await supabase
      .from("abc_settings")
      .select("*")
      .single();

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setAbcSettings(data);
    }
  };

  const updateABCSettings = async () => {
    if (!abcSettings) return;

    const { error } = await supabase
      .from("abc_settings")
      .update({
        analysis_period_days: abcSettings.analysis_period_days,
        threshold_a_percent: abcSettings.threshold_a_percent,
        threshold_b_percent: abcSettings.threshold_b_percent,
        threshold_c_percent: abcSettings.threshold_c_percent,
      })
      .eq("id", abcSettings.id);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "ABC settings updated successfully",
      });
    }
  };

  const recalculateABC = async () => {
    setIsCalculating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { data, error } = await supabase.functions.invoke("calculate-abc", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: data.message,
      });
      fetchABCSettings();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Configure your account and application preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ABC Segmentation</CardTitle>
          <CardDescription>
            Configure ABC analysis thresholds and recalculate product categories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="analysis-period">Analysis Period</Label>
            <Select
              value={abcSettings?.analysis_period_days.toString()}
              onValueChange={(value) =>
                setAbcSettings((prev) => prev ? { ...prev, analysis_period_days: parseInt(value) } : null)
              }
            >
              <SelectTrigger id="analysis-period">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 365 days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="threshold-a">Category A Threshold (%)</Label>
              <Input
                id="threshold-a"
                type="number"
                step="1"
                value={abcSettings?.threshold_a_percent || ""}
                onChange={(e) =>
                  setAbcSettings((prev) =>
                    prev ? { ...prev, threshold_a_percent: parseFloat(e.target.value) } : null
                  )
                }
              />
              <p className="text-xs text-muted-foreground">Top revenue contributors</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold-b">Category B Threshold (%)</Label>
              <Input
                id="threshold-b"
                type="number"
                step="1"
                value={abcSettings?.threshold_b_percent || ""}
                onChange={(e) =>
                  setAbcSettings((prev) =>
                    prev ? { ...prev, threshold_b_percent: parseFloat(e.target.value) } : null
                  )
                }
              />
              <p className="text-xs text-muted-foreground">Medium performers</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="threshold-c">Category C Threshold (%)</Label>
              <Input
                id="threshold-c"
                type="number"
                step="1"
                value={abcSettings?.threshold_c_percent || ""}
                onChange={(e) =>
                  setAbcSettings((prev) =>
                    prev ? { ...prev, threshold_c_percent: parseFloat(e.target.value) } : null
                  )
                }
              />
              <p className="text-xs text-muted-foreground">Low performers</p>
            </div>
          </div>

          {abcSettings?.last_calculated_at && (
            <Alert>
              <AlertDescription>
                Last calculated: {new Date(abcSettings.last_calculated_at).toLocaleString()}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={updateABCSettings}>
              Save Settings
            </Button>
            {isAdmin && (
              <Button
                onClick={recalculateABC}
                disabled={isCalculating}
                variant="secondary"
              >
                {isCalculating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Recalculate ABC
                  </>
                )}
              </Button>
            )}
          </div>

          {!isAdmin && (
            <Alert>
              <AlertDescription>
                Only admin users can recalculate ABC categories
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing Configuration</CardTitle>
          <CardDescription>
            Set your default pricing rules and targets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target-margin">Target Margin (%)</Label>
            <Input
              id="target-margin"
              type="number"
              placeholder="25"
              defaultValue="25"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="market-position">Desired Market Position</Label>
            <select
              id="market-position"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
            >
              <option value="cheaper_than_avg">Cheaper than average</option>
              <option value="around_avg">Around average</option>
              <option value="premium">Premium positioning</option>
            </select>
          </div>
          <Button>Save Settings</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>
            Update your personal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full-name">Full Name</Label>
            <Input id="full-name" placeholder="John Doe" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="john@company.com" />
          </div>
          <Button>Update Account</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
