import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import KeycloakProvider from 'next-auth/providers/keycloak'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { Role } from '@/generated/prisma/client'
import { isReservedSystemEmail } from './system-user'
import { KeycloakLinkError, linkKeycloakUserToDatabase } from './keycloak-user-link'

const authDebug = process.env.NODE_ENV !== 'production'

export const authOptions: NextAuthOptions = {
  providers: [
    // Keycloak OIDC for all users
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_ID!,
      clientSecret: process.env.KEYCLOAK_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
      profile(profile) {
        if (authDebug) {
          console.log('Keycloak profile:', JSON.stringify(profile, null, 2))
        }

        const realmRoles = profile.realm_access?.roles || []
        const clientRoles = profile.resource_access?.[process.env.KEYCLOAK_ID!]?.roles || []
        const directRoles = profile.roles || []
        const allRoles = [...realmRoles, ...clientRoles, ...directRoles]

        if (authDebug) {
          console.log('All roles found:', allRoles)
        }

        const isAdmin = allRoles.some(role => 
          role.toLowerCase() === 'admin' || 
          role.toLowerCase() === 'it_admin' ||
          role.toLowerCase() === 'administrator'
        )

        if (authDebug) {
          console.log('User is admin:', isAdmin)
        }
        
        return {
          id: profile.sub,
          name: profile.name ?? profile.preferred_username,
          email: profile.email,
          role: isAdmin ? Role.ADMIN : Role.USER,
          isKeycloakUser: true,
        }
      },
    }),
    // Credentials for regular users
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials')
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || !user.password || user.isKeycloakUser || user.isSystem || isReservedSystemEmail(user.email)) {
          throw new Error('Invalid credentials')
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

        if (!isPasswordValid) {
          throw new Error('Invalid credentials')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          isKeycloakUser: user.isKeycloakUser,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle Keycloak SSO users
      if (account?.provider === 'keycloak') {
        if (isReservedSystemEmail(user.email || '')) return false

        try {
          await linkKeycloakUserToDatabase({
            id: user.id!,
            email: user.email!,
            name: user.name || 'User',
            role: user.role as Role,
            activate: true,
          })
          if (authDebug) {
            console.log('Keycloak user linked:', user.email, 'Role:', user.role)
          }
        } catch (error) {
          if (error instanceof KeycloakLinkError) {
            console.error('Keycloak signIn rejected:', error.message)
          } else {
            console.error('Error in Keycloak signIn callback:', error)
          }
          return false
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        // Use Keycloak's sub (UUID) directly as the ID
        token.id = user.id
        token.role = user.role
        token.isKeycloakUser = user.isKeycloakUser
        token.department = user.department
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as Role
        session.user.isKeycloakUser = token.isKeycloakUser as boolean
        session.user.department = token.department as string | undefined
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
}

