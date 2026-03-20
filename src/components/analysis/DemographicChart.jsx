import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))"
];

const LABELS = {
  commuters: "Commuters",
  residents: "Residents",
  tourists: "Tourists",
  shoppers: "Shoppers"
};

export default function DemographicsChart({ data }) {
  if (!data) return null;

  const chartData = Object.entries(data)
    .filter(([_, val]) => val > 0)
    .map(([key, val]) => ({
      name: LABELS[key] || key,
      value: val
    }));

  return (
    <div className="flex items-center gap-4">
      <div className="w-28 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={50}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => `${value}%`}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px"
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-1.5">
        {chartData.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-xs text-muted-foreground">{entry.name}</span>
            <span className="text-xs font-semibold">{entry.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}