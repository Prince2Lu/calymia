import { Star } from "./Star";
import { AvisStarsInput } from "./AvisStarsInput";

type AvisStarsDisplayProps = {
  mode: "display";
  value: number;
  count?: number;
};

type AvisStarsInputModeProps = {
  mode: "input";
  value: number;
  onChange: (n: number) => void;
};

export type AvisStarsProps = AvisStarsDisplayProps | AvisStarsInputModeProps;

export function AvisStars(props: AvisStarsProps) {
  if (props.mode === "input") {
    return <AvisStarsInput value={props.value} onChange={props.onChange} />;
  }
  return <AvisStarsDisplay value={props.value} count={props.count} />;
}

function AvisStarsDisplay({ value, count }: Omit<AvisStarsDisplayProps, "mode">) {
  const filledCount = Math.round(value);
  const noteLabel = value.toFixed(1);

  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`Note de ${noteLabel} sur 5`}>
      <span className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} filled={n <= filledCount} size={18} />
        ))}
      </span>
      {count !== undefined && count > 0 && (
        <span className="text-sm text-slate-700">
          <span className="font-medium text-slate-800">{noteLabel}</span>{" "}
          <span className="text-slate-500">
            ({count} avis)
          </span>
        </span>
      )}
    </span>
  );
}
