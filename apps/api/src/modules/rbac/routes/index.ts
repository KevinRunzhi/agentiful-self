/**
 * RBAC Routes Index
 *
 * Main router file that registers all RBAC routes.
 */

import type { FastifyInstance } from 'fastify';
import { rolesRoutes } from './roles.routes.js';
import { userRolesRoutes } from './user-roles.routes.js';
import { permissionsRoutes } from './permissions.routes.js';
import { grantsRoutes } from './grants.routes.js';
import { breakglassRoutes } from './breakglass.routes.js';
import { appsRoutes } from './apps.routes.js';

export async function rbacRoutes(fastify: FastifyInstance) {
  // Route modules already define concrete paths (e.g. /roles, /grants),
  // so we register them without additional nested prefixes.
  await fastify.register(rolesRoutes);
  await fastify.register(userRolesRoutes);
  await fastify.register(permissionsRoutes);
  await fastify.register(grantsRoutes);
  await fastify.register(breakglassRoutes);
  await fastify.register(appsRoutes);
}
