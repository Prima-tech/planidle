import { Component, inject, OnInit } from '@angular/core';
import { SceneManager } from 'src/app/scenes/scene-manager';
import { StatusService } from 'src/app/services/status';

@Component({
  selector: 'app-main',
  templateUrl: './main.page.html',
  styleUrls: ['./main.page.scss'],
  standalone: false,
})
export class MainPage implements OnInit {

  private sceneManager = inject(SceneManager);

  constructor(
    private status: StatusService
  ) { }

  ngOnInit() {
  }

  test() {
    this.status.setStatus(10);
  }

  changeScene(scene: string) {
    this.sceneManager.changeScene(scene);
  }
}
