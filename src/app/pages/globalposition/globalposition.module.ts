
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

import { GlobalpositionPageRoutingModule } from './globalposition-routing.module';
import { GlobalpositionPage } from './globalposition.page';

@NgModule({
    imports: [
        CommonModule,
        FormsModule,
        IonicModule,
        GlobalpositionPageRoutingModule,
        TranslateModule
    ],
    declarations: [GlobalpositionPage]
})
export class GlobalpositionPageModule { }
