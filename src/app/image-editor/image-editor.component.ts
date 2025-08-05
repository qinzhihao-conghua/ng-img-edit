// image-editor.component.ts
import { Component, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { fabric } from 'fabric';

@Component({
  selector: 'app-image-editor',
  templateUrl: './image-editor.component.html',
  styleUrls: ['./image-editor.component.scss']
})
export class ImageEditorComponent implements AfterViewInit {
  @ViewChild('canvasContainer', { static: true }) canvasContainer!: ElementRef;
  @ViewChild('canvasElement', { static: true }) canvasElement!: ElementRef<HTMLCanvasElement>;

  private canvas!: fabric.Canvas;
  private imageObject: fabric.Image | null = null;
  private originalImage: fabric.Image | null = null;
  private history: string[] = [];
  private historyIndex: number = -1;

  isDrawingMode: boolean = false;
  isCropMode: boolean = false;
  isMosaicMode: boolean = false;
  cropRect: fabric.Rect | null = null;
  brushSize: number = 10;
  mosaicSize: number = 24;
  mosaicStyle: string = 'circle';
  textContent: string = '添加文本';
  textColor: string = '#000000';
  textSize: number = 24;
  showTextControls: boolean = false;
  selectedTextObject: fabric.IText | null = null;
  handleCanvasTextAddBound: ((options: any) => void) | null = null;

  ngAfterViewInit() {
    this.initializeCanvas();
  }

  private initializeCanvas() {
    this.canvas = new fabric.Canvas(this.canvasElement.nativeElement, {
      width: 800,
      height: 500,
      backgroundColor: '#f0f0f0',
      preserveObjectStacking: true
    });
  }

  loadImage(event: any) {
    console.log('Load image called');
    const file = event.target.files[0];
    if (!file) {
      console.log('No file selected');
      return;
    }
    console.log('File selected:', file.name);

    const reader = new FileReader();
    reader.onload = (e: any) => {
      console.log('File read completed');
      fabric.Image.fromURL(e.target.result, (img) => {
        console.log('Image created from URL');
        // 清除当前内容
        this.canvas.clear();
        this.imageObject = img;
        console.log('Image object set:', img);
        
        // 缩放图片以适应画布
        const scale = Math.min(
          1,
          (this.canvas.width || 800) / (img.width || 1),
          (this.canvas.height || 500) / (img.height || 1)
        );
        img.scale(scale);
        console.log('Image scaled:', scale);

        // 居中图片
        img.set({
          left: ((this.canvas.width || 800) - (img.width || 1) * scale) / 2,
          top: ((this.canvas.height || 500) - (img.height || 1) * scale) / 2,
          selectable: false, // 禁用选择功能，防止出现控制点
          evented: false,    // 禁用事件处理，防止拖动
          lockMovementX: true, // 锁定X轴移动
          lockMovementY: true, // 锁定Y轴移动
          lockRotation: true,  // 锁定旋转
          lockScalingX: true,  // 锁定X轴缩放
          lockScalingY: true,  // 锁定Y轴缩放
          hasControls: false,  // 隐藏控制点
          hasBorders: false    // 隐藏边框
        });
        console.log('Image positioned and made unselectable without controls');

        this.canvas.add(img);
        this.canvas.renderAll();
        
        // 保存原始图片（未缩放和居中处理的版本）
        (img as any).clone((clonedImg: fabric.Image) => {
          this.originalImage = clonedImg;
          console.log('Original image saved');
          // 在originalImage设置完成后保存状态
          this.saveState();
          console.log('Image added to canvas and state saved');
        });
      });
    };
    reader.readAsDataURL(file);
  }

  toggleDrawingMode() {
    this.isDrawingMode = !this.isDrawingMode;
    
    // 结束其他功能
    if (this.isDrawingMode) {
      this.endCropMode();
      this.endMosaicMode();
      
      this.canvas.isDrawingMode = true;
      this.canvas.freeDrawingBrush.width = this.brushSize;
      this.canvas.freeDrawingBrush.color = '#000000';
    } else {
      this.canvas.isDrawingMode = false;
    }
    
    this.saveState();
  }

  toggleCropMode() {
    console.log('Toggle crop mode called, current state:', this.isCropMode);
    this.isCropMode = !this.isCropMode;
    console.log('New crop mode state:', this.isCropMode);
    
    // 结束其他功能
    if (this.isCropMode) {
      this.endDrawingMode();
      this.endMosaicMode();
      
      this.canvas.isDrawingMode = false;
      console.log('Entering crop mode');
      // 创建裁剪矩形，使其与图片大小一致
      const img = this.imageObject;
      let width = 200;
      let height = 200;
      let left = 100;
      let top = 100;
      
      if (img) {
        console.log('Image object found:', img);
        width = img.width * (img.scaleX || 1);
        height = img.height * (img.scaleY || 1);
        left = img.left || 0;
        top = img.top || 0;
        console.log('Crop rect dimensions:', { width, height, left, top });
        // 确保图片在裁剪模式下可选择
        img.selectable = true;
        img.evented = true;
      } else {
        console.log('No image object found');
      }
      
      this.cropRect = new fabric.Rect({
        width: width,
        height: height,
        left: left,
        top: top,
        fill: 'rgba(0,0,0,0.3)',
        stroke: '#000000',
        strokeWidth: 2,
        strokeDashArray: [5, 5],
        selectable: true,
        hasControls: true,
        hasBorders: true,
        lockRotation: true
      });

      console.log('Crop rect created:', this.cropRect);
      this.canvas.add(this.cropRect);
      this.canvas.setActiveObject(this.cropRect);
      
      // 添加事件监听器来处理裁剪矩形的修改
      this.cropRect.on('modified', () => {
        if (this.cropRect) {
          console.log('Crop rect modified:', {
            left: this.cropRect.left,
            top: this.cropRect.top,
            width: this.cropRect.width,
            height: this.cropRect.height
          });
          // 确保裁剪矩形的边界坐标是最新的
          this.cropRect.setCoords();
        }
      });
      
      // 添加事件监听器来处理裁剪矩形的缩放
      this.cropRect.on('scaling', () => {
        if (this.cropRect) {
          console.log('Crop rect scaling:', {
            left: this.cropRect.left,
            top: this.cropRect.top,
            width: this.cropRect.width,
            height: this.cropRect.height
          });
          // 确保裁剪矩形的边界坐标是最新的
          this.cropRect.setCoords();
        }
      });
      
      // 添加事件监听器来处理裁剪矩形的移动
      this.cropRect.on('moving', () => {
        if (this.cropRect) {
          console.log('Crop rect moving:', {
            left: this.cropRect.left,
            top: this.cropRect.top,
            width: this.cropRect.width,
            height: this.cropRect.height
          });
          // 确保裁剪矩形的边界坐标是最新的
          this.cropRect.setCoords();
        }
      });
      
      console.log('Crop rect added to canvas');
    } else {
      console.log('Exiting crop mode');
      // 移除裁剪矩形
      if (this.cropRect) {
        console.log('Removing crop rect');
        this.canvas.remove(this.cropRect);
        this.cropRect = null;
      } else {
        console.log('No crop rect to remove');
      }
      // 恢复图片的可选择性
      if (this.imageObject) {
        console.log('Restoring image selectability');
        this.imageObject.selectable = true;
        this.imageObject.evented = true;
      } else {
        console.log('No image object to restore');
      }
    }
    
    this.saveState();
  }

  applyCrop() {
    console.log('Apply crop called');
    
    if (!this.imageObject || !this.cropRect) {
      console.log('Missing image object or crop rect');
      return;
    }

    const img = this.imageObject;
    const rect = this.cropRect;

    // 更新裁剪矩形的边界坐标
    rect.setCoords();
    
    // 计算裁剪区域相对于图片的位置
    const scale = img.scaleX || 1;
    const imgLeft = img.left || 0;
    const imgTop = img.top || 0;

    console.log('Image info:', { imgLeft, imgTop, scale, imgWidth: img.width, imgHeight: img.height });

    // 获取裁剪区域的边界坐标（相对于画布）
    const rectLeft = rect.left || 0;
    const rectTop = rect.top || 0;
    // 使用getBoundingRect获取准确的边界坐标
    const rectBounding = rect.getBoundingRect();
    const rectWidth = rectBounding.width;
    const rectHeight = rectBounding.height;
    const rectRight = rectLeft + rectWidth;
    const rectBottom = rectTop + rectHeight;
    
    console.log('Crop rect info:', { rectLeft, rectTop, rectWidth, rectHeight });
    
    // 计算图片边界（相对于画布）
    const imgRight = imgLeft + (img.width || 0) * scale;
    const imgBottom = imgTop + (img.height || 0) * scale;
    
    // 计算裁剪区域与图片的交集
    const cropLeft = Math.max(rectLeft, imgLeft);
    const cropTop = Math.max(rectTop, imgTop);
    const cropRight = Math.min(rectRight, imgRight);
    const cropBottom = Math.min(rectBottom, imgBottom);
    
    // 计算相对于图片的裁剪区域坐标
    const cropX = (cropLeft - imgLeft) / scale;
    const cropY = (cropTop - imgTop) / scale;
    const cropWidth = (cropRight - cropLeft) / scale;
    const cropHeight = (cropBottom - cropTop) / scale;

    console.log('Calculated crop area:', { cropX, cropY, cropWidth, cropHeight });

    // 检查裁剪区域是否有效
    if (cropWidth <= 0 || cropHeight <= 0) {
      console.log('Invalid crop area');
      return;
    }

    // 创建临时canvas来执行裁剪
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) {
      console.log('Failed to get canvas context');
      return;
    }

    // 设置canvas尺寸
    tempCanvas.width = cropWidth;
    tempCanvas.height = cropHeight;

    console.log('Temp canvas size:', { width: tempCanvas.width, height: tempCanvas.height });

    // 绘制裁剪区域
    tempCtx.drawImage(
      img.getElement(),
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    // 创建新的fabric图片对象，位置设置为画布中央
    const croppedImg = new fabric.Image(tempCanvas, {
      left: (this.canvas.width - cropWidth) / 2,
      top: (this.canvas.height - cropHeight) / 2,
      scaleX: 1,
      scaleY: 1
    });

    console.log('Cropped image created');

    // 打印原图片和裁剪后图片的信息
    console.log('Original image info:', {
      width: img.width,
      height: img.height,
      left: img.left,
      top: img.top,
      scaleX: img.scaleX,
      scaleY: img.scaleY
    });
    
    console.log('Cropped image info:', {
      width: croppedImg.width,
      height: croppedImg.height,
      left: croppedImg.left,
      top: croppedImg.top,
      scaleX: croppedImg.scaleX,
      scaleY: croppedImg.scaleY
    });

    // 替换原图片
    this.canvas.remove(img);
    this.canvas.add(croppedImg);
    this.imageObject = croppedImg;
    
    // 验证图片是否已替换
    console.log('Image replaced, new image object:', this.imageObject);

    // 移除裁剪矩形
    this.canvas.remove(rect);
    this.cropRect = null;
    this.isCropMode = false;

    this.canvas.renderAll();
    this.saveState();

    console.log('Crop applied successfully');
  }

  toggleMosaicMode() {
    this.isMosaicMode = !this.isMosaicMode;
    
    // 结束其他功能
    if (this.isMosaicMode) {
      this.endDrawingMode();
      this.endCropMode();
      
      this.canvas.isDrawingMode = false;
      // 进入马赛克模式
      console.log('Entering mosaic mode');
      
      // 禁用图片的选择功能，防止拖动
      if (this.imageObject) {
        this.imageObject.selectable = false;
        this.imageObject.evented = false;
        console.log('Image selectability disabled');
      }
      
      // 禁用画布的选中框显示
      this.canvas.selection = false;
      
      // 绑定鼠标事件
      this.canvas.on('mouse:move', this.applyMosaic.bind(this));
      this.canvas.on('mouse:down', this.startMosaic.bind(this));
      this.canvas.on('mouse:up', this.stopMosaic.bind(this));
      console.log('Mouse events bound');
    } else {
      // 退出马赛克模式
      console.log('Exiting mosaic mode');
      
      // 恢复图片的选择功能
      if (this.imageObject) {
        this.imageObject.selectable = true;
        this.imageObject.evented = true;
        console.log('Image selectability restored');
      }
      
      // 恢复画布的选中框显示
      this.canvas.selection = true;
      
      // 解绑鼠标事件
      this.canvas.off('mouse:move', this.applyMosaic.bind(this));
      this.canvas.off('mouse:down', this.startMosaic.bind(this));
      this.canvas.off('mouse:up', this.stopMosaic.bind(this));
      console.log('Mouse events unbound');
    }
    
    this.saveState();
  }

  // 马赛克功能相关变量
  private isMosaicActive = false;
  private lastMosaicPoint = { x: -1, y: -1 };
  private lastMosaicTime = 0;
  
  // 结束绘制模式
  private endDrawingMode() {
    this.isDrawingMode = false;
    this.canvas.isDrawingMode = false;
  }
  
  // 结束裁剪模式
  private endCropMode() {
    if (this.isCropMode) {
      this.isCropMode = false;
      // 移除裁剪矩形
      if (this.cropRect) {
        this.canvas.remove(this.cropRect);
        this.cropRect = null;
      }
      // 恢复图片的可选择性
      if (this.imageObject) {
        this.imageObject.selectable = true;
        this.imageObject.evented = true;
      }
    }
  }
  
  // 结束马赛克模式
  private endMosaicMode() {
    if (this.isMosaicMode) {
      this.isMosaicMode = false;
      // 恢复图片的选择功能
      if (this.imageObject) {
        this.imageObject.selectable = true;
        this.imageObject.evented = true;
      }
      
      // 恢复画布的选中框显示
      this.canvas.selection = true;
      
      // 解绑鼠标事件
      this.canvas.off('mouse:move', this.applyMosaic.bind(this));
      this.canvas.off('mouse:down', this.startMosaic.bind(this));
      this.canvas.off('mouse:up', this.stopMosaic.bind(this));
    }
  }

  startMosaic(event: fabric.IEvent) {
    // 检查是否是鼠标左键
    if (event.e instanceof MouseEvent && event.e.button !== 0) return;
    
    this.isMosaicActive = true;
    // 重置上一个马赛克点的位置
    this.lastMosaicPoint = { x: -1, y: -1 };
    
    // 应用初始马赛克点
    this.applyMosaic(event);
  }

  stopMosaic(event: fabric.IEvent) {
    this.isMosaicActive = false;
    // 重置上一个马赛克点的位置
    this.lastMosaicPoint = { x: -1, y: -1 };
    // 保存状态
    this.saveState();
  }

  applyMosaic(event: fabric.IEvent) {
    // 只有在马赛克模式激活时才应用效果
    if (!this.isMosaicMode || !this.isMosaicActive || !this.imageObject) return;

    // 限制马赛克应用频率以提高性能，但不要太严格
    const now = Date.now();
    if (now - this.lastMosaicTime < 20) return; // 更宽松的频率限制
    this.lastMosaicTime = now;

    const pointer = this.canvas.getPointer(event.e);
    const img = this.imageObject;
    const scale = img.scaleX || 1;

    // 计算相对于图片的位置
    const imgX = (pointer.x - (img.left || 0)) / scale;
    const imgY = (pointer.y - (img.top || 0)) / scale;

    // 获取图片元素
    const imgElement = img.getElement();

    // 创建离屏canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = img.width || 1;
    canvas.height = img.height || 1;

    // 绘制当前图片
    ctx.drawImage(imgElement, 0, 0);

    // 应用马赛克效果
    const size = this.mosaicSize;
    const x = Math.floor(imgX - size / 2);
    const y = Math.floor(imgY - size / 2);

    // 检查边界
    if (x < 0 || y < 0 || x + size > canvas.width || y + size > canvas.height) return;

    // 如果有上一个点，则在两点之间创建连续的马赛克路径
    if (this.lastMosaicPoint.x !== -1 && this.lastMosaicPoint.y !== -1) {
      const prevX = Math.floor(this.lastMosaicPoint.x - size / 2);
      const prevY = Math.floor(this.lastMosaicPoint.y - size / 2);
      
      // 计算两点之间的距离和方向
      const dx = x - prevX;
      const dy = y - prevY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 如果距离较大，则在两点之间创建插值点
      if (distance > size / 2) {
        const steps = Math.ceil(distance / (size / 2));
        for (let i = 0; i <= steps; i++) {
          const interpX = Math.floor(prevX + (dx * i) / steps);
          const interpY = Math.floor(prevY + (dy * i) / steps);
          
          // 检查边界
          if (interpX >= 0 && interpY >= 0 && interpX + size <= canvas.width && interpY + size <= canvas.height) {
            this.applyMosaicAtPoint(ctx, interpX, interpY, size);
          }
        }
      } else {
        // 距离较近，直接应用当前点
        this.applyMosaicAtPoint(ctx, x, y, size);
      }
    } else {
      // 没有上一个点，直接应用当前点
      this.applyMosaicAtPoint(ctx, x, y, size);
    }

    // 更新上一个点的位置
    this.lastMosaicPoint = { x: imgX, y: imgY };

    // 更新图片源
    (img as any).setElement(canvas);
    this.canvas.renderAll();
    // 注意：在鼠标移动过程中不保存状态，只在停止操作时保存
  }

  // 在指定位置应用马赛克效果
  private applyMosaicAtPoint(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    // 获取区域像素数据
    const imageData = ctx.getImageData(x, y, size, size);
    const data = imageData.data;

    // 计算区域平均颜色
    let r = 0, g = 0, b = 0, a = 0;
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      a += data[i + 3];
    }
    const count = data.length / 4;
    r = Math.floor(r / count);
    g = Math.floor(g / count);
    b = Math.floor(b / count);
    a = Math.floor(a / count);

    // 根据选择的风格应用马赛克效果
    if (this.mosaicStyle === 'circle') {
      // 创建圆形马赛克效果，使用平均颜色填充
      ctx.beginPath();
      ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a/255})`;
      ctx.fill();
    } else {
      // 默认方形马赛克效果
      // 填充整个区域为平均颜色
      for (let i = 0; i < data.length; i += 4) {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = a;
      }
      // 将修改后的像素数据放回
      ctx.putImageData(imageData, x, y);
    }
  }

  toggleTextControls() {
    this.showTextControls = !this.showTextControls;
    
    // 移除之前的画布点击事件监听器
    if (this.handleCanvasTextAddBound) {
      this.canvas.off('mouse:down', this.handleCanvasTextAddBound);
      this.handleCanvasTextAddBound = null;
    }
    
    // 如果是打开文本控制面板，则添加画布点击事件监听器
    if (this.showTextControls) {
      // 添加画布点击事件监听器来添加文本
      this.handleCanvasTextAddBound = this.handleCanvasTextAdd.bind(this);
      this.canvas.on('mouse:down', this.handleCanvasTextAddBound);
    }
  }

  selectTextColor(color: string) {
    this.textColor = color;
  }

  addText() {
    // 使用默认文本
    const textContent = '添加文本';
    
    const text = new fabric.IText(textContent, {
      left: 100,
      top: 100,
      fontFamily: 'Arial',
      fontSize: this.textSize,
      fill: this.textColor,
      selectable: true
    });

    // 添加双击编辑功能
    text.on('mousedown', (options: any) => {
      if (options.e.detail === 2) { // 检查是否为双击
        this.canvas.setActiveObject(text); // 激活文本对象
        text.enterEditing(); // 进入编辑模式
        text.selectAll(); // 选中所有文本
        this.canvas.requestRenderAll(); // 重新渲染画布
      }
    });

    // 添加失去焦点时退出编辑模式的功能
    text.on('editing:exited', () => {
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      this.saveState();
    });

    this.canvas.add(text);
    // 激活新添加的文本对象，让用户看到矩形框
    this.canvas.setActiveObject(text);
    this.canvas.requestRenderAll();
    
    // 监听画布点击事件，当点击画布外区域时完成文本编辑
    const canvasClickHandler = (options: any) => {
      // 检查点击的是否是文本对象本身
      if (options.target !== text) {
        // 如果点击的不是文本对象，则退出编辑模式
        if (text.isEditing) {
          text.exitEditing();
        }
        // 移除事件监听器
        this.canvas.off('mouse:down', canvasClickHandler);
      }
    };
    
    // 延迟添加事件监听器，避免立即触发
    setTimeout(() => {
      this.canvas.on('mouse:down', canvasClickHandler);
    }, 100);
    
    this.saveState();
  }

  handleCanvasTextAdd(options: any) {
    // 检查是否点击在已存在的文本对象上
    const clickedObject = options.target;
    
    // 如果点击的是文本对象，则不添加新文本
    if (clickedObject && clickedObject.type === 'i-text') {
      // 如果是双击，则进入编辑模式
      if (options.e.detail === 2) {
        this.canvas.setActiveObject(clickedObject);
        clickedObject.enterEditing();
        clickedObject.selectAll();
        this.canvas.requestRenderAll();
      }
      // 无论单击还是双击文本对象，都应该返回，不创建新文本
      return;
    }
    
    // 获取点击位置
    const pointer = this.canvas.getPointer(options.e);
    
    // 使用默认文本
    const textContent = '添加文本';
    
    const text = new fabric.IText(textContent, {
      left: pointer.x,
      top: pointer.y,
      fontFamily: 'Arial',
      fontSize: this.textSize,
      fill: this.textColor,
      selectable: true
    });

    // 添加双击编辑功能
    text.on('mousedown', (options: any) => {
      if (options.e.detail === 2) { // 检查是否为双击
        this.canvas.setActiveObject(text); // 激活文本对象
        text.enterEditing(); // 进入编辑模式
        text.selectAll(); // 选中所有文本
        this.canvas.requestRenderAll(); // 重新渲染画布
      }
    });

    // 添加失去焦点时退出编辑模式的功能
    text.on('editing:exited', () => {
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      this.saveState();
    });

    this.canvas.add(text);
    // 激活新添加的文本对象，让用户看到矩形框
    this.canvas.setActiveObject(text);
    this.canvas.requestRenderAll();
    
    // 监听画布点击事件，当点击画布外区域时完成文本编辑
    const canvasClickHandler = (options: any) => {
      // 检查点击的是否是文本对象本身
      if (options.target !== text) {
        // 如果点击的不是文本对象，则退出编辑模式
        if (text.isEditing) {
          text.exitEditing();
        }
        // 移除事件监听器
        this.canvas.off('mouse:down', canvasClickHandler);
      }
    };
    
    // 延迟添加事件监听器，避免立即触发
    setTimeout(() => {
      this.canvas.on('mouse:down', canvasClickHandler);
    }, 100);
    
    this.saveState();
    
    // 移除画布点击事件监听器
    if (this.handleCanvasTextAddBound) {
      this.canvas.off('mouse:down', this.handleCanvasTextAddBound);
    }
  }

  undo() {
    if (this.historyIndex <= 0) return;

    this.historyIndex--;
    const state = this.history[this.historyIndex];
    this.loadState(state);
  }

  reset() {
    console.log('Reset called, originalImage:', this.originalImage);
    // 检查originalImage是否存在
    if (!this.originalImage) {
      console.log('Original image is undefined, cannot reset');
      return;
    }

    this.canvas.clear();
    // 克隆原始图片
    (this.originalImage as any).clone((img: fabric.Image) => {
      this.imageObject = img;
      
      console.log('Cloned image:', img);
      
      // 确保克隆的图片有有效的宽度和高度
      if (!img.width || !img.height) {
        console.log('Cloned image has invalid dimensions');
        return;
      }
      
      // 缩放图片以适应画布
      const scale = Math.min(
        1,
        (this.canvas.width || 800) / (img.width || 1),
        (this.canvas.height || 500) / (img.height || 1)
      );
      img.scale(scale);

      console.log('Scaled image with scale:', scale);

      // 居中图片
      img.set({
        left: ((this.canvas.width || 800) - (img.width || 1) * scale) / 2,
        top: ((this.canvas.height || 500) - (img.height || 1) * scale) / 2,
        selectable: true
      });
      
      this.canvas.add(img);
      
      // 重置所有模式
      this.isDrawingMode = false;
      this.isCropMode = false;
      this.isMosaicMode = false;
      this.canvas.isDrawingMode = false;
      
      // 移除裁剪矩形（如果存在）
      if (this.cropRect) {
        this.canvas.remove(this.cropRect);
        this.cropRect = null;
      }
      
      this.canvas.renderAll();
      
      // 重置历史记录
      this.history = [];
      this.historyIndex = -1;
      // 保存初始状态
      this.saveState();
      
      console.log('Reset completed');
    });
  }

  saveState() {
    // 创建一个不包含历史记录的canvas状态
    const objects = this.canvas.getObjects();
    const canvasData = {
      objects: [],
      background: this.canvas.backgroundColor
    };

    // 保存图片对象和其他对象
    objects.forEach(obj => {
      if (obj.type === 'image') {
        try {
          // 对于图片对象，保存其数据URL
          const imgElement = (obj as any).toDataURL();
          canvasData.objects.push({
            type: 'image',
            src: imgElement,
            left: obj.left,
            top: obj.top,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            width: obj.width,
            height: obj.height
          });
        } catch (error) {
          console.error('Error saving image object:', error);
        }
      } else {
        // 对于其他对象，直接序列化
        canvasData.objects.push(obj.toObject());
      }
    });

    const state = JSON.stringify(canvasData);
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(state);
    this.historyIndex = this.history.length - 1;
  }

  loadState(state: string) {
    const canvasData = JSON.parse(state);
    
    // 清空画布
    this.canvas.clear();
    
    // 恢复背景色
    if (canvasData.background) {
      this.canvas.backgroundColor = canvasData.background;
    }
    
    // 恢复对象
    const promises: Promise<void>[] = [];
    
    canvasData.objects.forEach((objData: any) => {
      if (objData.type === 'image') {
        // 恢复图片对象
        const promise = new Promise<void>((resolve) => {
          fabric.Image.fromURL(objData.src, (img) => {
            img.set({
              left: objData.left,
              top: objData.top,
              scaleX: objData.scaleX,
              scaleY: objData.scaleY
            });
            this.canvas.add(img);
            // 确保imageObject指向恢复的图片
            this.imageObject = img;
            resolve();
          });
        });
        promises.push(promise);
      } else {
        // 恢复其他对象
        const promise = new Promise<void>((resolve) => {
          // 确保objData是有效的对象
          if (objData && typeof objData === 'object') {
            (fabric.util as any).enlivenObjects([objData], (enlivenedObjects: fabric.Object[]) => {
              enlivenedObjects.forEach((obj) => {
                this.canvas.add(obj);
              });
              resolve();
            });
          } else {
            // 如果objData无效，则直接resolve
            resolve();
          }
        });
        promises.push(promise);
      }
    });
    
    // 等待所有对象都恢复完成后再渲染
    Promise.all(promises).then(() => {
      this.canvas.renderAll();
    });
  }

  exportAsPNG() {
    // 使用fabric.js的toDataURL方法直接导出整个画布
    const dataURL = this.canvas.toDataURL({
      format: 'png',
      quality: 1
    });
    
    // 创建下载链接
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = 'edited-image.png';
    link.click();
  }

  // 设置画笔大小
  setBrushSize(size: number) {
    this.brushSize = size;
    if (this.canvas.isDrawingMode) {
      this.canvas.freeDrawingBrush.width = size;
    }
  }

  // 设置马赛克大小
  setMosaicSize(size: number) {
    this.mosaicSize = size;
  }



  // 设置马赛克风格
  setMosaicStyle(style: string) {
    this.mosaicStyle = style;
  }

  // 设置文本大小
  setTextSize(size: number) {
    this.textSize = size;
  }
}