import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TopBarComponent } from './top-bar/top-bar.component';
import { StatusBarComponent } from './status-bar/status-bar.component';

@NgModule({
  declarations: [
    TopBarComponent,
    StatusBarComponent
  ],
  imports: [
    CommonModule,
    IonicModule
  ],
  exports: [
    TopBarComponent,
    StatusBarComponent,
  ]
})
export class ComponentModule {}