import { Component } from '@angular/core';
import Phaser from 'phaser';
import { FakeApiService } from '../services/fakeapi';
import { ProfileService } from '../services/profile';
import { StaticData } from '../mocks/mock-inventory';

@Component({
    selector: 'app-home',
    templateUrl: 'home.page.html',
    styleUrls: ['home.page.scss'],
    standalone: false,
})
export class HomePage  {
    phaserGame: Phaser.Game | undefined;
    items = StaticData.items;


    constructor(
     public service: FakeApiService,
     public profile: ProfileService,
    ) {
     
    }



    

}