
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { GlobalpositionPageRoutingModule } from './globalposition-routing.module';
import { GlobalpositionPage } from './globalposition.page';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        GlobalpositionPageRoutingModule
    ],
    declarations: [GlobalpositionPage]
})
export class GlobalpositionPageModule { }
