import { Component, inject } from "@angular/core";
import { SceneManager } from "src/app/scenes/scene-manager";

@Component({
  selector: 'test-page',
  templateUrl: './test.page.html',
  styleUrls: ['./test.page.scss'],
  standalone: false

  
})

export class testPageComponent {
  
private sceneManager = inject(SceneManager);

  changeScene(scene: string) {
    this.sceneManager.changeScene(scene);
  } 

  test() {
   // this.status.setStatus(10);
  }

}