'use strict';

/**
 * Boots both backends at once so the whole thing comes up with `npm start`.
 *
 * In production these are two independent deployments: the control plane runs
 * in its own stack and the business backend runs in another. Here they share a
 * process because it is easier to run on a laptop. Nothing else about the
 * boundary changes - see README.md.
 */

require('./control');
require('./backend-business');
