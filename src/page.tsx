// The lock's code in the dashboard's page (D-509, D-510): the cylinder in section. A chamber for each die across the housing and the plug, a spring, a driver
// pin and a key pin in each; the shear line between housing and plug; a pin passed has its driver caught over the line, one held is half way, a 1 is marked.
// The pick, of a fixed length, slides in the keyway under the pin it works on, and out of the lock once it is open. Drawn with the page's tokens, in style
// objects (the page's security keeps out <style>); it moves once the dice land, from the data before to the data now, and never with reduced motion.
import type { JSX } from "preact";
import { useId } from "preact/hooks";
import type { FigureProps, PageModule } from "rpg-engine/page";
import type { Tumblers } from "./tumblers.ts";

/** The cylinder of the card of a roll and of the card beside the page. */
function TumblersFigure({ data, before, reducedMotion }: FigureProps)
{
    const now = data as Tumblers;
    const was = before as Tumblers | undefined;
    const shape = shapeOf(now.pins);
    const width = shape.edge * 2 + now.pins * shape.pitch;
    const left = 34;
    const centre = (pin: number): number => shape.edge + shape.pitch * (pin + 0.5);
    // The shaft reaches the last pin with its handle just out of the lock; most of it stays out of sight on the left, fading.
    const shaft = centre(now.pins - 1) + 6;
    const tip = now.pick === null ? -12 : centre(now.pick);
    const pickLift = now.pick !== null && kindOf(now, now.pick) === "held" ? heldLift : 0;
    // The pins lifted since the look before, in order, then the pick slides on: the moves wait for one another, a share of --quick each.
    const lifted = was === undefined ? 0 : Math.max(0, now.up - was.up);
    // Ids of the drawing's gradient and mask, one set per cylinder.
    const id = `tumblers-${useId()}`;
    return (
        <svg viewBox={`${-left} 0 ${width + left + 4} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true" style={{ display: "block", width: "100%", height: "100%" }}>
            <defs>
                <linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1={-left} y1={0} x2={-left + 22} y2={0}>
                    <stop offset="0" stop-color="white" stop-opacity="0" />
                    <stop offset="1" stop-color="white" stop-opacity="1" />
                </linearGradient>
                <mask id={`${id}-out`} maskUnits="userSpaceOnUse" x={-left} y={0} width={width + left + 4} height={height}>
                    <rect x={-left} y={0} width={width + left + 4} height={height} fill={`url(#${id}-fade)`} />
                </mask>
            </defs>
            <path d={`M0 10a10 10 0 0 1 10 -10H${width - 10}a10 10 0 0 1 10 10V${shear}H0Z`} style={paint.housing} />
            <path d={`M0 ${shear}H${width}V72a10 10 0 0 1 -10 10H10a10 10 0 0 1 -10 -10Z`} style={paint.plug} />
            <rect x={0} y={floor + 1} width={width - shape.edge + 2} height={11} rx={3} style={paint.hole} />
            {Array.from({ length: now.pins }, (_, pin) => <Pin key={pin} x={centre(pin)} kind={kindOf(now, pin)} shape={shape} motion={reducedMotion ? undefined : motionOf(now, was, pin)} />)}
            <line x1={0} y1={shear} x2={width} y2={shear} style={paint.shear} />
            <g mask={`url(#${id}-out)`}>
                <g style={{ transform: `translate(${tip}px, ${floor + 6.5 - pickLift}px)`, ...(reducedMotion ? {} : { transition: `transform var(--medium) var(--ease) ${step(lifted)}` }) }}>
                    <rect x={-shaft - 22} y={-4.5} width={22} height={9} rx={3} style={paint.handle} />
                    <path d={`M${-shaft} 0H-4Q0 0 0 -5.5`} style={paint.shaft} />
                </g>
            </g>
        </svg>
    );
}

const page: PageModule = { figures: { tumblers: TumblersFigure } };

export default page;

/** What a pin shows: caught over the line, held half way, a 1, one the roll may lift, or down. */
type Kind = "up" | "held" | "one" | "coming" | "down";

/** How the pins are drawn: few wide, many narrow, so that twenty stay readable. */
interface Shape
{
    pitch: number;
    edge: number;
    chamber: number;
    driver: number;
}

// The cylinder's heights, in the drawing's units: the shear line, the floor of the chambers over the keyway, the pins.
const height = 84;
const shear = 44;
const floor = 66;
const keyHeight = 12;
const driverHeight = 22;
const heldLift = 5;

const paint: Record<string, JSX.CSSProperties> = {
    housing: { fill: "color-mix(in srgb, var(--ink) 5%, var(--float))", stroke: "var(--rule)", strokeWidth: 1.5 },
    plug: { fill: "color-mix(in srgb, var(--ink) 20%, var(--float))", stroke: "var(--rule)", strokeWidth: 1.5 },
    hole: { fill: "var(--paper)" },
    shear: { stroke: "var(--accent)", strokeWidth: 1.5, strokeDasharray: "4 3", opacity: 0.75 },
    spring: { fill: "none", stroke: "var(--muted)", strokeWidth: 1.2, strokeLinejoin: "round", opacity: 0.7 },
    handle: { fill: "var(--muted)" },
    shaft: { fill: "none", stroke: "var(--ink)", strokeWidth: 2.5, strokeLinecap: "round" },
    cross: { stroke: "var(--low)", strokeWidth: 2, strokeLinecap: "round" },
};

const drivers: Record<Kind, JSX.CSSProperties> = {
    up: { fill: "var(--accent)", stroke: "var(--accent)", strokeWidth: 1.5 },
    held: { fill: "color-mix(in srgb, var(--accent) 35%, var(--float))", stroke: "var(--accent)", strokeWidth: 1.5 },
    one: { fill: "color-mix(in srgb, var(--low) 12%, var(--float))", stroke: "var(--low)", strokeWidth: 1.5 },
    coming: { fill: "color-mix(in srgb, var(--accent) 10%, transparent)", stroke: "var(--accent)", strokeWidth: 1.5, strokeDasharray: "3 2" },
    down: { fill: "color-mix(in srgb, var(--muted) 35%, var(--float))", stroke: "var(--muted)", strokeWidth: 1.5 },
};

/** A chamber with its spring, driver and key pin, each moved into place by a transform, which the page's motion tokens ease. */
function Pin({ x, kind, shape, motion }: { x: number; kind: Kind; shape: Shape; motion: string | undefined; })
{
    const lift = kind === "held" ? heldLift : 0;
    const keyTop = floor - keyHeight - lift;
    const driverTop = kind === "up" ? shear - driverHeight : keyTop - driverHeight;
    const half = shape.driver / 2;
    const moved = (y: number): JSX.CSSProperties => ({ transform: `translateY(${y}px)`, ...(motion === undefined ? {} : { transition: `transform ${motion}` }) });
    // The spring is drawn a unit tall and stretched to the driver's top, its line kept as thick.
    const spring = Array.from({ length: 7 }, (_, turn) => `${x + (turn === 0 || turn === 6 ? 0 : turn % 2 === 0 ? -half * 0.8 : half * 0.8)} ${turn / 6}`).join(" ");
    return (
        <g>
            <rect x={x - shape.chamber / 2} y={4} width={shape.chamber} height={floor - 2} rx={2} style={{ ...paint.hole, ...(kind === "one" ? { stroke: "var(--low)", strokeWidth: 1.5 } : {}) }} />
            <g style={{ transformOrigin: "0 0", transform: `translateY(6px) scaleY(${driverTop - 7})`, ...(motion === undefined ? {} : { transition: `transform ${motion}` }) }}>
                <polyline points={spring} vector-effect="non-scaling-stroke" style={paint.spring} />
            </g>
            <g style={moved(driverTop)}>
                <rect x={x - half} y={0} width={shape.driver} height={driverHeight} rx={2} style={drivers[kind]} />
                {kind === "one" && <path d={`M${x - half + 1} ${driverHeight / 2 - 4}l${shape.driver - 2} 8M${x + half - 1} ${driverHeight / 2 - 4}l${-(shape.driver - 2)} 8`} style={paint.cross} />}
            </g>
            <g style={moved(keyTop)}>
                <path
                    d={`M${x - half} 1.5q0 -1.5 1.5 -1.5h${shape.driver - 3}q1.5 0 1.5 1.5V${keyHeight - 4}L${x} ${keyHeight}L${x - half} ${keyHeight - 4}Z`}
                    style={{ ...drivers.down, fill: "color-mix(in srgb, var(--muted) 20%, var(--float))", strokeLinejoin: "round", ...(kind === "held" ? { stroke: "var(--accent)" } : {}) }}
                />
            </g>
        </g>
    );
}

/** The shape of a cylinder of so many pins. */
function shapeOf(pins: number): Shape
{
    return pins <= 8 ? { pitch: 24, edge: 12, chamber: 14, driver: 10 } : { pitch: 16, edge: 10, chamber: 11, driver: 8 };
}

/** What a pin shows now. */
function kindOf(cylinder: Tumblers, pin: number): Kind
{
    if (pin < cylinder.up) {
        return "up";
    }

    if (pin < cylinder.up + cylinder.held) {
        return "held";
    }

    if (cylinder.ones.includes(pin)) {
        return "one";
    }

    const after = cylinder.up + cylinder.held + cylinder.ones.length;
    return pin >= after && pin < after + cylinder.coming ? "coming" : "down";
}

/**
 * How a pin moves from the look before: lifted, one after the other from the first lifted, with a little bounce; back down at once, the spring's push, as
 * the lock resets; else a plain ease.
 */
function motionOf(now: Tumblers, was: Tumblers | undefined, pin: number): string
{
    const [from, to] = [was === undefined ? "down" : kindOf(was, pin), kindOf(now, pin)];

    if (to === "up" && from !== "up") {
        return `var(--short) var(--ease-bounce) ${step(pin - (was?.up ?? 0))}`;
    }

    if ((from === "up" || from === "held") && to !== "up" && to !== "held") {
        return "var(--short) var(--ease-in)";
    }

    return "var(--short) var(--ease)";
}

/** The wait before the nth move of a row, a share of --quick. */
function step(order: number): string
{
    return `calc(${Math.max(0, order)} * var(--quick) / 2)`;
}
