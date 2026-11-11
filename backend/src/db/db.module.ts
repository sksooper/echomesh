import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service';

// @Global — DbService jest dostępny w każdym module bez ponownego importu
@Global()
@Module({ providers: [DbService], exports: [DbService] })
export class DbModule {}
