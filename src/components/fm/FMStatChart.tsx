import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type Variant = "line" | "bar" | "area";

export const FMStatChart = ({
  data,
  xKey,
  series,
  variant = "line",
  height = 220,
  stacked = false,
}: {
  data: Array<Record<string, any>>;
  xKey: string;
  series: { key: string; label?: string; color?: string }[];
  variant?: Variant;
  height?: number;
  stacked?: boolean;
}) => {
  const palette = [
    "hsl(var(--fm-accent))",
    "hsl(var(--fm-good))",
    "hsl(var(--fm-warn))",
    "hsl(var(--fm-bad))",
    "#7aa2ff",
    "#c084fc",
  ];

  const axis = { stroke: "hsl(var(--fm-border))", fontSize: 10, tick: { fill: "hsl(var(--fm-fg-muted))" } } as const;
  const grid = <CartesianGrid stroke="hsl(var(--fm-border))" strokeDasharray="2 3" vertical={false} />;
  const tooltip = (
    <Tooltip
      contentStyle={{
        background: "hsl(var(--fm-panel-2))",
        border: "1px solid hsl(var(--fm-border))",
        borderRadius: 2,
        fontSize: 11,
        color: "hsl(var(--fm-fg))",
      }}
      cursor={{ fill: "hsl(var(--fm-panel-2) / 0.5)" }}
    />
  );

  const Chart: any = variant === "bar" ? BarChart : variant === "area" ? AreaChart : LineChart;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -12 }}>
        {grid}
        <XAxis dataKey={xKey} {...axis} />
        <YAxis {...axis} />
        {tooltip}
        <Legend wrapperStyle={{ fontSize: 10, color: "hsl(var(--fm-fg-muted))" }} />
        {series.map((s, i) => {
          const color = s.color ?? palette[i % palette.length];
          if (variant === "bar")
            return (
              <Bar key={s.key} dataKey={s.key} name={s.label ?? s.key} fill={color} stackId={stacked ? "a" : undefined} />
            );
          if (variant === "area")
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label ?? s.key}
                stroke={color}
                fill={color}
                fillOpacity={0.2}
                stackId={stacked ? "a" : undefined}
              />
            );
          return (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label ?? s.key}
              stroke={color}
              strokeWidth={1.5}
              dot={false}
            />
          );
        })}
      </Chart>
    </ResponsiveContainer>
  );
};

export default FMStatChart;
