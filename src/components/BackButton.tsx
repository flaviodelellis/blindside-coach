import { useT } from "../i18n";

type Props = {
  onClick: () => void;
  className?: string;
};

export function BackButton({ onClick, className }: Props) {
  const t = useT();
  return (
    <button
      type="button"
      className={`back-button${className ? ` ${className}` : ""}`}
      onClick={onClick}
      aria-label={t("common.home")}
    >
      {t("common.home")}
    </button>
  );
}
