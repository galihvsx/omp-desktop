
interface PiLogoProps extends React.SVGProps<SVGSVGElement> {}

const PiLogo = ({
  width = 18,
  height = 18,
  ...props
}: PiLogoProps): JSX.Element => (
  <svg
    width={width}
    height={height}
    aria-hidden="true"
    viewBox="0 0 64 64"
    {...props}
  >
    <defs>
      <linearGradient id="pi-mark-15-grad" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stopColor="oklch(0.7 0.24 340)"></stop>
        <stop offset="0.5" stopColor="oklch(0.62 0.21 295)"></stop>
        <stop offset="1" stopColor="oklch(0.81 0.14 200)"></stop>
      </linearGradient>
    </defs>
    <path
      fill="url(#pi-mark-15-grad)"
      d="M10 14h44v9H43v33h-9V23h-9v22h-9V23h-6z"
    ></path>
  </svg>
);

export default PiLogo;
