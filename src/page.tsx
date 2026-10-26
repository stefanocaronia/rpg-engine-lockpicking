// The lock's code in the dashboard's page (D-509, D-510): the cylinder in section, a pin for each die, those lifted above the shear line, the held, the 1s
// marked and the pick under the pin it works on. A stand-in for now, drawn with the page's tokens, which the full drawing takes the place of.
import type { FigureProps, PageModule } from "rpg-engine/page";
import type { Tumblers } from "./tumblers.ts";

/** The cylinder: for now each pin a bar, lifted, held, marked or down, and the pick a line under its pin. */
function TumblersFigure({ data, size }: FigureProps)
{
    const tumblers = data as Tumblers;
    const width = size.width / Math.max(1, tumblers.pins);
    const state = (pin: number): string => (pin < tumblers.up ? "up" : pin < tumblers.up + tumblers.held ? "held" : tumblers.ones.includes(pin) ? "marked" : "down");
    return (
        <svg class="tumblers" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
            {Array.from({ length: tumblers.pins }, (_, pin) => <rect key={pin} class={`pin ${state(pin)}`} x={pin * width + width / 4} y={state(pin) === "up" ? 8 : 32} width={width / 2} height={48} />)}
            {tumblers.pick !== null && <line class="pick" x1={0} y1={size.height - 8} x2={tumblers.pick * width + width / 2} y2={size.height - 8} />}
        </svg>
    );
}

const page: PageModule = { figures: { tumblers: TumblersFigure } };

export default page;
