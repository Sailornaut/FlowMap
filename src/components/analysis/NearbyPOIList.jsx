import { MapPin, Train, Coffee, ShoppingBag, Building2, GraduationCap, Landmark, TreePine } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const iconMap = {
  transit: Train,
  restaurant: Coffee,
  retail: ShoppingBag,
  office: Building2,
  school: GraduationCap,
  landmark: Landmark,
  park: TreePine,
};

export default function NearbyPOIList({ pois }) {
  if (!pois || pois.length === 0) return null;

  return (
    <div className="space-y-2">
      {pois.map((poi, i) => {
        const Icon = iconMap[poi.type] || MapPin;
        return (
          <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{poi.name}</p>
              <p className="text-xs text-muted-foreground">{poi.distance}</p>
            </div>
            <Badge variant="secondary" className="text-[10px] shrink-0">
              {poi.type}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}