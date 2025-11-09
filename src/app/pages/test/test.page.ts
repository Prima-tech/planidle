import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import { IonicModule } from "@ionic/angular";
import { SceneManager } from "src/app/scenes/scene-manager";

@Component({
  selector: 'test-page',
  templateUrl: './test.page.html',
  styleUrls: ['./test.page.scss'],
    imports: [
    CommonModule,  
    IonicModule 
  ]

  
})

export class testPageComponent {
  
private sceneManager = inject(SceneManager);

  changeScene(scene: string) {
    this.sceneManager.changeScene(scene);
  } 

}