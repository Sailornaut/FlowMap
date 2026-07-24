import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createProperty } from "@/lib/api-client";

const PROPERTY_TYPES = [
  "strip_center",
  "neighborhood_center",
  "community_center",
  "power_center",
  "lifestyle_center",
  "mixed_use",
  "standalone",
  "outlet",
  "other",
];

export default function PropertyCreate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    property_type: "",
    total_sqft: "",
    year_built: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: (data) => createProperty(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["workspace-properties"] });
      toast.success("Property created");
      navigate(`/workspace/properties/${result.id}`);
    },
    onError: (err) => {
      toast.error(err.message || "Could not create property.");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (payload.total_sqft) payload.total_sqft = Number(payload.total_sqft);
    if (payload.year_built) payload.year_built = Number(payload.year_built);
    // Remove empty strings
    for (const [k, v] of Object.entries(payload)) {
      if (v === "") delete payload[k];
    }
    mutation.mutate(payload);
  };

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e?.target?.value ?? e }));

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/workspace/properties")}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">New property</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Property details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="Sunrise Plaza"
                value={form.name}
                onChange={set("name")}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="123 Main St"
                value={form.address}
                onChange={set("address")}
                required
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={set("city")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  placeholder="CA"
                  maxLength={2}
                  value={form.state}
                  onChange={set("state")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zip">Zip</Label>
                <Input
                  id="zip"
                  placeholder="90210"
                  value={form.zip}
                  onChange={set("zip")}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="property_type">Type</Label>
                <Select
                  value={form.property_type}
                  onValueChange={(v) =>
                    setForm((prev) => ({ ...prev, property_type: v }))
                  }
                >
                  <SelectTrigger id="property_type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="total_sqft">Total sqft</Label>
                <Input
                  id="total_sqft"
                  type="number"
                  min={0}
                  value={form.total_sqft}
                  onChange={set("total_sqft")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="year_built">Year built</Label>
                <Input
                  id="year_built"
                  type="number"
                  min={1800}
                  max={2030}
                  value={form.year_built}
                  onChange={set("year_built")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={set("notes")}
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Creating…" : "Create property"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
