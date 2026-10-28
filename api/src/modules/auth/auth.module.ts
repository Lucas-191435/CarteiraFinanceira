import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import authConfig from 'src/config/authConfig';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';

@Module({
  imports: [
    JwtModule.register({
      secret: authConfig.secret,
      signOptions: {
        expiresIn: authConfig.expiresIn,
        algorithm: authConfig.algorithm,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository],
})
export class AuthModule {}
