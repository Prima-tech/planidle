import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TopBarComponent } from './top-bar/top-bar.component';
import { StatusBarComponent } from './status-bar/status-bar.component';
import { IconComponent } from './icon/icon.component';
import { InventoryComponent } from './inventory/inventory.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FooterBarComponent } from './footer-bar/footer-bar.component';

@NgModule({
  declarations: [
    TopBarComponent,
    StatusBarComponent,
    IconComponent,
    InventoryComponent,
    FooterBarComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    DragDropModule
  ],
  exports: [
    TopBarComponent,
    StatusBarComponent,
    IconComponent,
    InventoryComponent,
    FooterBarComponent
  ]
})
export class ComponentModule {}