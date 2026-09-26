import {
  ActivityIcon,
  ArrowDownToLineIcon,
  AtomIcon,
  ChevronsDownIcon,
  CircleIcon,
  FlameIcon,
  GitCompareArrowsIcon,
  SplineIcon,
  WavesIcon,
  ZapIcon,
} from "lucide-react"

/**
 * The starting points offered under the home page composer.
 *
 * The label is what the button says; the prompt is what is actually run.
 * They are deliberately different lengths — a button has room for two or
 * three words, and the agent needs a specification.
 *
 * Every prompt covers a scenario that is fully within the approved solver
 * catalog in `@/lib/games/runtime/simulation`. Each carries every quantity
 * the model needs, with its unit, so the first turn can build without
 * asking questions first. Prompts stay in the user's voice — nothing here
 * names a solver function, a file, or a unit symbol the code uses
 * internally.
 */
export const suggestions = [
  {
    label: "Projectile motion",
    icon: SplineIcon,
    prompt:
      "An educational simulation of a projectile launched at 25 m/s at 40 " +
      "degrees above the horizontal, from 1.5 m above flat ground, with " +
      "gravitational acceleration 9.81 m/s² and no aerodynamic drag. Plot " +
      "height against horizontal distance, and report the flight time, the " +
      "horizontal range and the maximum height. Let me change the speed, the " +
      "angle and the release height and see the trajectory update.",
  },
  {
    label: "Pendulum",
    icon: ActivityIcon,
    prompt:
      "An educational simulation of a simple pendulum: a 0.5 kg bob on a " +
      "1.2 m massless rod, released from 35 degrees from vertical with no " +
      "initial velocity, under 9.81 m/s² gravity. Use the exact nonlinear " +
      "equation of motion. Plot angle and angular velocity over time, show " +
      "the kinetic, potential and total energy, and compare the actual period " +
      "to the small-angle approximation. Let me change the length, mass and " +
      "release angle.",
  },
  {
    label: "Spring-mass",
    icon: ZapIcon,
    prompt:
      "An educational simulation of a spring-mass system: mass 2 kg, spring " +
      "constant 50 N/m, initial displacement 0.1 m from equilibrium, no " +
      "initial velocity. First show undamped free vibration, then let me add " +
      "a damping coefficient to explore underdamped, critically damped and " +
      "overdamped behaviour. Plot displacement and velocity over 5 seconds. " +
      "Report the natural frequency, period and damping ratio.",
  },
  {
    label: "Launch angles",
    icon: GitCompareArrowsIcon,
    prompt:
      "Compare two launch angles for the same projectile: 20 m/s from ground " +
      "level with 9.81 m/s² gravity and no drag, taking 30 degrees as the " +
      "baseline and 45 degrees as the variation. Draw both trajectories on " +
      "one plot, and put the horizontal range, flight time and maximum height " +
      "side by side with the difference between them. Let me edit either " +
      "angle and the speed.",
  },
  {
    label: "Buoyancy",
    icon: WavesIcon,
    prompt:
      "An educational simulation of hydrostatic pressure and Archimedes " +
      "buoyancy in fresh water (density 1000 kg/m³, g = 9.81 m/s²). Plot " +
      "absolute and gauge pressure against depth for a 3 m column. Then " +
      "analyse a solid steel sphere of mass 4 kg and volume 510 cm³: will it " +
      "float or sink? Report the buoyant force, net force, and apparent " +
      "weight. Let me change the object's mass and volume.",
  },
  {
    label: "Ideal gas",
    icon: FlameIcon,
    prompt:
      "An educational simulation of an ideal gas undergoing a quasi-static " +
      "isothermal compression. Start with 0.01 mol of diatomic ideal gas at " +
      "300 K, initial pressure 101325 Pa, initial volume 24.6 L. Compress " +
      "isothermally to a final volume of 12.3 L. Show the p-V diagram, " +
      "report the final pressure, the work done on the gas, and the heat " +
      "exchanged. Let me switch between isothermal, isobaric, isochoric, and " +
      "adiabatic processes.",
  },
  {
    label: "RC circuit",
    icon: CircleIcon,
    prompt:
      "An educational simulation of an RC circuit charging from a 9 V source. " +
      "Resistance 10 kΩ, capacitance 100 µF, capacitor initially uncharged. " +
      "Plot capacitor voltage, current, and stored energy against time over " +
      "5 time constants. Report the time constant τ = RC. Let me change the " +
      "resistance and capacitance.",
  },
  {
    label: "Beam, point load",
    icon: ArrowDownToLineIcon,
    prompt:
      "A preliminary estimate for a simply supported steel beam spanning 6 m " +
      "with a single 12 kN point load at midspan. Young's modulus is 210 GPa " +
      "and the second moment of area is 8500 cm⁴. Show the shear force, " +
      "bending moment and deflection along the span, and report the support " +
      "reactions and the maximum deflection. Let me change the span, the load " +
      "and the section properties.",
  },
  {
    label: "Beam, distributed",
    icon: ChevronsDownIcon,
    prompt:
      "A preliminary estimate for a simply supported timber beam spanning " +
      "4.5 m under a uniform distributed load of 3.2 kN/m. Young's modulus " +
      "is 11 GPa and the second moment of area is 21000 cm⁴. Plot the shear " +
      "force, bending moment and deflection along the span, and report the " +
      "maximum bending moment and the maximum deflection with the assumptions " +
      "behind them. Let me change the span, the load and the section " +
      "properties.",
  },
  {
    label: "Circular motion",
    icon: AtomIcon,
    prompt:
      "An educational simulation of uniform circular motion: a 0.3 kg ball " +
      "moving at 4 m/s on a horizontal circle of radius 0.8 m. Report the " +
      "angular velocity, period, frequency, centripetal acceleration and the " +
      "centripetal force required. Animate the position over two full " +
      "revolutions and show the velocity vector at each point. Let me change " +
      "the speed and radius.",
  },
]
