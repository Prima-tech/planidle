import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TopBarComponent } from './top-bar/top-bar.component';

@NgModule({
  declarations: [
    TopBarComponent
  ],
  imports: [
    CommonModule,
    IonicModule
  ],
  exports: [
    TopBarComponent
  ]
})
export class ComponentModule {}