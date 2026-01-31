
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GlobalpositionPage } from './globalposition.page';

const routes: Routes = [
    {
        path: '',
        component: GlobalpositionPage
    }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule],
})
export class GlobalpositionPageRoutingModule { }
