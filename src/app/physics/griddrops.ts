import { Player } from "../pnj/player/player";

export class GridDrops {
  
  constructor(
    private player: Player,
    public mainScene: Phaser.Scene,

  ) {
    this.mainScene.events.on('enemyDied', (position: Phaser.Math.Vector2) => {
      this.dropItem(position);
    });
  }

    dropItem(position: Phaser.Math.Vector2) {
      console.log('dropitem');
      
      const offsetX = Phaser.Math.Between(500, 20); // Desplazamiento aleatorio en X
      const offsetY = Phaser.Math.Between(-20, 20); // Desplazamiento aleatorio en Y
      const droppedItem = this.mainScene.add.image(
          position.x + offsetX,
          position.y + offsetY,
          'sword'
      );
      droppedItem.setScale(3);
      droppedItem.setOrigin(0.5, 0.5);
      /*


      // Añadir overlap entre el jugador y el objeto
      this.physics.add.overlap(
          this.player.sprite, // Sprite del jugador
          droppedItem, // Objeto dropeado
          () => {
              this.onItemCollected(droppedItem);
          }
      );

      console.log("Item dropped at", droppedItem.x, droppedItem.y);

      */
  }
}