// Launch hardening — env-driven feature gates.
//
// NATIONAL_SHIP (UPS 2-day cold chain) is NOT launch-ready: the label
// pipeline has known gaps (fixed MVP parcel under-charges shipping; spec
// details unverified against live EasyPost). Until it gets its own hardening
// pass, the channel is offered ONLY where NATIONAL_SHIP_ENABLED=1 is set —
// unset in production = customers never see the option; dev/test keeps it.

export function isNationalShipEnabled(): boolean {
    return process.env.NATIONAL_SHIP_ENABLED === '1';
}
