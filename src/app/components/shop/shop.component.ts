import { Component, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { PlayerStateService } from 'src/app/services/player-state.service';
import { AccountShopService, ACCOUNT_SHOP_ITEMS, AccountShopItem } from 'src/app/services/account-shop.service';

@Component({
  selector: 'app-shop',
  templateUrl: './shop.component.html',
  styleUrls: ['./shop.component.scss'],
  standalone: false
})
export class ShopComponent implements OnDestroy {
  private playerState = inject(PlayerStateService);
  private accountShop = inject(AccountShopService);

  readonly items = ACCOUNT_SHOP_ITEMS;

  /** Moneda de la tienda premium: la Marca del condenado (misma que el inventario). */
  readonly specialCoins$ = this.playerState.specialCoins$;
  private coins = 0;
  private coinsSub: Subscription = this.specialCoins$.subscribe(v => this.coins = v);

  ngOnDestroy(): void { this.coinsSub.unsubscribe(); }

  owned(id: string): boolean { return this.accountShop.isPurchased(id); }
  canBuy(item: AccountShopItem): boolean {
    return this.coins >= item.price && this.accountShop.requirementMet(item);
  }
  buy(id: string): void { this.accountShop.buy(id); }
}
