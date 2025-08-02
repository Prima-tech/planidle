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
import { MapSelectedCellComponent } from './map-selected-cell/map-selected-cell.component';

@NgModule({
  declarations: [
    TopBarComponent,
    StatusBarComponent,
    IconComponent,
    InventoryComponent,
    FooterBarComponent,
    LayoutComponent,
    MapSelectedCellComponent
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
    LayoutComponent,
    MapSelectedCellComponent
  ]
})
export class ComponentModule {}