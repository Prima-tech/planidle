import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { LayoutComponent } from './components/layout/layout.component';

const routes: Routes = [
  {
    path: 'home',
    loadChildren: () => import('./home/home.module').then( m => m.HomePageModule)
  },
  {
    path: '',
    component: LayoutComponent, // layout base
    children: [
      {
        path: 'inventory',
        loadChildren: () => import('./pages/inventory/inventory.module').then(m => m.InventoryPageModule)
      },
      {
        path: 'main',
        loadChildren: () => import('./pages/main/main.module').then(m => m.MainPageModule)
      },
      {
        path: 'map',
        loadChildren: () => import('./pages/map/map.module').then(m => m.MapPageModule)
      },
      {
        path: '',
        redirectTo: 'main',
        pathMatch: 'full'
      }
    ]
  },


  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
