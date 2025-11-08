import { inject } from "@angular/core";

export class MapScene extends Phaser.Scene {
  CELL_SIZE = 64;
  MAP_ROWS = 11;
  MAP_COLS = 11;

  mapConfig: any[][] = [];
  mapService: any;
  cellsVisuals: Phaser.GameObjects.Sprite[][] = [];
  private cellSelected:any = null;
  private dragStartX = 0;
  private dragStartY = 0;
  private isDragging = false;

  constructor(
   ) {
    super({ key: 'MapScene' });
    const centerRow = Math.floor(this.MAP_ROWS / 2);
    const centerCol = Math.floor(this.MAP_COLS / 2);
    for (let row = 0; row < this.MAP_ROWS; row++) {
      this.mapConfig[row] = [];
      for (let col = 0; col < this.MAP_COLS; col++) {
        if (row === centerRow && col === centerCol) {
          this.mapConfig[row][col] = {
            type: 'city',
            playersActivesOnTile: [],
            explored: true,
            resource: null
          };
        } else {
          this.mapConfig[row][col] = {
            type: 'mine',
            playersActivesOnTile: [],
            explored: false,
            resource: null
          };
        }
      }
    }
    
    // Ejemplo celda diferente
    /*
    this.mapConfig[0][1] = {
      type: 'tierra',
      playersActivesOnTile: [3],
      explored: true,
      resource: 'oro'
    };
    */
  }

  preload() {
    this.load.image('city', 'assets/sprites/map/city.png');
    this.load.image('explored', 'assets/sprites/map/explored.png');
    this.load.image('mine', 'assets/sprites/map/mine.png');
    this.load.image('forest', 'assets/sprites/map/forest.png');
    this.load.image('sea', 'assets/sprites/map/sea.png');
    this.load.image('crop', 'assets/sprites/map/crop.png');
    this.mapService = this.game.registry.get('mapService');
  }

  create() {
    // Crear sprites para cada celda, posicion fija en mundo
    for (let row = 0; row < this.MAP_ROWS; row++) {
      this.cellsVisuals[row] = [];
      for (let col = 0; col < this.MAP_COLS; col++) {
        const cellData = this.mapConfig[row][col];
        const sprite = this.add.sprite(
          col * this.CELL_SIZE,
          row * this.CELL_SIZE,
          cellData.explored ? cellData.type : 'explored'
        )
        .setOrigin(0, 0)
        .setInteractive();
        sprite.displayWidth = this.CELL_SIZE;
        sprite.displayHeight = this.CELL_SIZE;
        (sprite as any).gridPos = { row, col };

        // Controlar click solo si no hubo drag
        sprite.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          this.dragStartX = pointer.x;
          this.dragStartY = pointer.y;
          this.isDragging = false;
        });

        sprite.on('pointermove', (pointer: Phaser.Input.Pointer) => {
          if (!pointer.isDown) return;
          const dx = pointer.x - this.dragStartX;
          const dy = pointer.y - this.dragStartY;
          if (!this.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
            this.isDragging = true;
          }
        });

        sprite.on('pointerup', () => {
          if (!this.isDragging) {
            this.events.emit('cellClicked', { row, col, ...cellData });
          }
        });
        this.cellsVisuals[row][col] = sprite;
      }
    }
    this.mapService.cellExplored$.subscribe(cell => {
      if (cell) {
        console.log('oye bro si soy yo', cell)
        this.cellSelected = cell;
        this.markCellExplored(cell);
      }
    });
    // Configurar límites para cámara
    this.cameras.main.setBounds(0, 0, this.MAP_COLS * this.CELL_SIZE, this.MAP_ROWS * this.CELL_SIZE);

    // Manejo drag para mover la cámara
    this.input.on('pointerdown', (pointer) => {
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.isDragging = false;
    });

    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      const dx = pointer.x - this.dragStartX;
      const dy = pointer.y - this.dragStartY;
      if (!this.isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
        this.isDragging = true;
      }
      if (this.isDragging) {
        const cam = this.cameras.main;
        cam.scrollX -= dx;
        cam.scrollY -= dy;

        // Limitar cámara dentro del mapa
        cam.scrollX = Phaser.Math.Clamp(cam.scrollX, 0, this.MAP_COLS * this.CELL_SIZE - cam.width);
        cam.scrollY = Phaser.Math.Clamp(cam.scrollY, 0, this.MAP_ROWS * this.CELL_SIZE - cam.height);

        // Actualizar drag start para smooth drag
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.events.on('cellClicked', (data) => {
      console.log('Clicked cell:', data);
      this.mapService.selectCell(data);
    });

    const centerX = (this.MAP_COLS * this.CELL_SIZE) / 2 - this.cameras.main.width / 2;
    const centerY = (this.MAP_ROWS * this.CELL_SIZE) / 2 - this.cameras.main.height / 2;
    this.cameras.main.scrollX = Phaser.Math.Clamp(centerX, 0, this.MAP_COLS * this.CELL_SIZE - this.cameras.main.width);
    this.cameras.main.scrollY = Phaser.Math.Clamp(centerY, 0, this.MAP_ROWS * this.CELL_SIZE - this.cameras.main.height);
  }

  exportMapConfig() {
    return JSON.stringify(this.mapConfig);
  }

  importMapConfig(newConfig: any[][]) {
    this.mapConfig = newConfig;
    for (let row = 0; row < this.MAP_ROWS; row++) {
      for (let col = 0; col < this.MAP_COLS; col++) {
        let cell = this.mapConfig[row][col];
        this.cellsVisuals[row][col].setTexture(cell.type);
        this.cellsVisuals[row][col].displayWidth = this.CELL_SIZE;
        this.cellsVisuals[row][col].displayHeight = this.CELL_SIZE;
      }
    }
  }

  markCellExplored(data: any) {
    const cell = this.mapConfig[data.row][data.col];
    cell.explored = true;
    const sprite = this.cellsVisuals[data.row][data.col];
    sprite.setTexture(cell.type);
    sprite.displayWidth = this.CELL_SIZE;
    sprite.displayHeight = this.CELL_SIZE;
  }
}
