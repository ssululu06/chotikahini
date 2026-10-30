const sectionIconFiles = [
  "noun_SexPosition_728772.svg",
  "noun_penis_2529051.svg",
  "noun_boobs_2062597.svg",
  "noun_makinglove_1581571.svg",
  "noun_SexPosition_728760.svg",
  "noun_SexPosition_728774.svg",
  "noun_Sexposition69_728758.svg",
  "noun_threesome_759966.svg",
  "noun_SexPosition_728753.svg",
  "noun_boobs_1041418.svg",
  "noun_SexPosition_728752.svg",
  "noun_blowjob_728757.svg",
];

const sectionIconColors = [
  "#f5a524",
  "#e85d75",
  "#a56de2",
  "#35a99a",
  "#5488dc",
  "#d9824b",
  "#cb5ba8",
  "#77a84b",
  "#e66b4e",
  "#368fa8",
  "#bc8a35",
  "#6c78c9",
];

const categoryIcons: Record<
  string,
  { file: (typeof sectionIconFiles)[number]; color: (typeof sectionIconColors)[number] }
> = {
  hot: { file: "noun_SexPosition_728772.svg", color: "#e66b4e" },
  bodhu: { file: "noun_SexPosition_728774.svg", color: "#e85d75" },
  tarona: { file: "noun_Sexposition69_728758.svg", color: "#a56de2" },
  obibahito: { file: "noun_SexPosition_728752.svg", color: "#35a99a" },
  bibahito: { file: "noun_makinglove_1581571.svg", color: "#5488dc" },
  porokiya: { file: "noun_SexPosition_728760.svg", color: "#d9824b" },
  kumari: { file: "noun_boobs_2062597.svg", color: "#cb5ba8" },
  prem: { file: "noun_SexPosition_728753.svg", color: "#77a84b" },
  pesha: { file: "noun_penis_2529051.svg", color: "#f5a524" },
  paribarik: { file: "noun_threesome_759966.svg", color: "#368fa8" },
  somokami: { file: "noun_boobs_1041418.svg", color: "#bc8a35" },
  aloukik: { file: "noun_blowjob_728757.svg", color: "#6c78c9" },
};

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

export function SectionIcon({
  seed,
  className,
}: {
  seed: string;
  className: string;
}) {
  const categoryIcon = categoryIcons[seed];
  const iconIndex = hashSeed(seed) % sectionIconFiles.length;
  const iconFile = categoryIcon?.file || sectionIconFiles[iconIndex];
  const color =
    categoryIcon?.color ||
    sectionIconColors[hashSeed(`${seed}:color`) % sectionIconColors.length];

  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: "block",
        flexShrink: 0,
        backgroundColor: color,
        maskImage: `url("/images/icons/${iconFile}")`,
        maskPosition: "center",
        maskRepeat: "no-repeat",
        maskSize: "contain",
        WebkitMaskImage: `url("/images/icons/${iconFile}")`,
        WebkitMaskPosition: "center",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
      }}
    />
  );
}
