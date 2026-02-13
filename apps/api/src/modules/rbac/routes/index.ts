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

export async function rbacRoutes(fastify: FastifyInstance) {
  // Register all RBAC route modules
  await fastify.register(rolesRoutes, { prefix: '/roles' });
  await fastify.register(userRolesRoutes, { prefix: '/users/:userId/roles' });
  await fastify.register(permissionsRoutes, { prefix: '/permissions' });
  await fastify.register(grantsRoutes, { prefix: '/grants' });
  await fastify.register(breakglassRoutes, { prefix: '/breakglass' });
}
