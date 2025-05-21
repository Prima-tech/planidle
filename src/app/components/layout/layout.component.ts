import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { GameScene } from 'src/app/scenes/gamescene/gamescene';
import { FakeApiService } from 'src/app/services/fakeapi';
import { ProfileService } from 'src/app/services/profile';
import Phaser from 'phaser';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
  standalone: false
})
export class LayoutComponent {

  config: Phaser.Types.Core.GameConfig | undefined;
  phaserGame: Phaser.Game | undefined;
  constructor(
    private router: Router,
    public service: FakeApiService,
    public profile: ProfileService,
  ) {
    this.loadScene();
  }

  ngOnInit(): void {
    this.phaserGame = new Phaser.Game(this.config);
    this.service.getUserData().subscribe((data) => {
      console.log('soy la data', data)
    })
  }

  loadScene() {
    this.config = {
      title: "Sample",
      render: {
        antialias: false,
      },
      physics: {
        default: 'arcade',
      },
      type: Phaser.AUTO,
      scene: GameScene,
      scale: {
        width: window.innerWidth,
        height: 200,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      parent: "game",
      backgroundColor: "#48C4F8",
    };
  }

  test() {
    this.profile.setStatus(10);
  }

}
