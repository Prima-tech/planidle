import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { testPageComponent } from './test.page';
import { ComponentModule } from 'src/app/components/components.module';


@NgModule({
  declarations: [testPageComponent],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ComponentModule
  ]
})
export class TestPageComponentModule {}
