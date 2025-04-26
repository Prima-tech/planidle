import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TopBarComponent } from './top-bar/top-bar.component';
import { StatusBarComponent } from './status-bar/status-bar.component';
import { IconComponent } from './icon/icon.component';
import { InventoryComponent } from './inventory/inventory.component';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { FooterBarComponent } from './footer-bar/footer-bar.component';
import { LayoutComponent } from './layout/layout.component';
import { RouterModule } from '@angular/router';

@NgModule({
  declarations: [
    TopBarComponent,
    StatusBarComponent,
    IconComponent,
    InventoryComponent,
    FooterBarComponent,
    LayoutComponent
  ],
  imports: [
    CommonModule,
    IonicModule,
    DragDropModule,
    RouterModule, //
  ],
  exports: [
    TopBarComponent,
    StatusBarComponent,
    IconComponent,
    InventoryComponent,
    FooterBarComponent,
    LayoutComponent
  ]
})
export class ComponentModule {}