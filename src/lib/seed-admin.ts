import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { Role } from '@/generated/prisma/client'
import { ensureSystemUser } from './system-user'

/**
 * Seeds a default admin user if no admin exists in the database
 * Call this on application startup
 */
export async function seedDefaultAdmin() {
  try {
    await ensureSystemUser()

    // A system account is not an admin and must not block this seed.
    const adminExists = await prisma.user.findFirst({
      where: { role: Role.ADMIN, isSystem: false },
    })

    if (adminExists) {
      console.log('✅ Admin user already exists')
      return
    }

    // Create default admin
    const defaultAdmin = {
      email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@informejo.local',
      password: process.env.DEFAULT_ADMIN_PASSWORD || 'ChangeMe123!',
      name: process.env.DEFAULT_ADMIN_NAME || 'System Administrator',
    }

    const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10)

    await prisma.user.create({
      data: {
        email: defaultAdmin.email,
        name: defaultAdmin.name,
        password: hashedPassword,
        role: Role.ADMIN,
        isKeycloakUser: false,
        isActive: true,
      },
    })

    console.log('✅ Default admin created successfully')
    console.log(`📧 Email: ${defaultAdmin.email}`)
    console.log(`🔑 Password: ${defaultAdmin.password}`)
    console.log('⚠️  Please change the password after first login!')
  } catch (error) {
    console.error('❌ Error seeding default admin:', error)
  }
}

