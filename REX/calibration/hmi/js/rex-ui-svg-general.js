/* GENERAL
* Version 2.52.0-15123
* Created 2023-03-29 19:03
*/
class AlarmsTable extends REX.UI.SVG.HTMLComponent {
    constructor(svgElem, args) {
        super(svgElem, args);        
        this.fontScale = this.utils.checkNumber(this.options.fontScale, 1);
        this.table = new REX.UI.AlarmsTable(this.div, this.options);
        this.table.init();
        this.on('updatePosition', () => {
            this.updateFontSize();
        });
        this.updateFontSize();
        this.disable(true);
    }
    updateFontSize() {
        let ctm = this.svg.getScreenCTM();
        // Scale according the width or height which is better
        if (ctm) {
            let size = Math.min(ctm.a, ctm.d) * this.fontScale + 'em';
            this.div.style.fontSize = size;
        }
    }
}

REX.UI.SVG.AlarmsTable = function (svgElem, args) {
    return new AlarmsTable(svgElem,args);
};
/**
 * SVG component represents BarGraph.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT}
 * @returns {REX.UI.SVG.BarGraph} New SVG BarGraph component
 */
REX.UI.SVG.BarGraph = function(svgElem,args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem,args);
    // Store options for simple usage
    var $o = that.options || {};
    
    // Load options or default values
    var r_min = that.checkNumber($o.rangeMin,0);   //minimum rozsahu
    var r_max = that.checkNumber($o.rangeMax,1);         //maximum rozsahu
    var tick_step = that.checkNumber($o.tickStep,5);          //krok maleho tiku
    var main_tick_step = that.checkNumber($o.mainTickStep,10);//krok hlavniho tiku s oznacenim
    var decimals = that.check($o.decimals || $o.digitalPrecision,2);       //pocet desetinnych mist pro zaokrouhleni digitalni hodnoty
    var o_units = $o.units || " ";                      //jednotky
    var colorZones = $o.colorZones || null;             //barevne zony
    var colorOffLimits = $o.colorOffLimits || "#ff7400";
    var levelColor1 = $o.levelColor1 || "#01d2ff";
    var levelColor2 = $o.levelColor2 || "#001070";
    var fSize = 28;
   
    // Get SVG elements for manipulation
    var bargraph_area = that.getChildByTag("bargraph_area"),             //cely objekt
        bargraph_level = that.getChildByTag("bargraph_level"),           //hladina bargrafu
        bargraph_capacity = that.getChildByTag("bargraph_capacity"),     //celkova velikost (kapacita) bargrafu
        border = that.getChildByTag("border"),                           //okraj (ramecek)
        digitalValue = that.getChildByTag("digitalval"),                   //digitalni hodnota
        textBox = that.getChildByTag("text_box") 
                || that.getChildByTag("display_box"),                  //ramecek digitalni hodnoty
        stopC1 = that.getChildByTag("stopC1"),
        stopC2 = that.getChildByTag("stopC2"),
        units = that.getChildByTag("units");                             //jednotky

    // Deprecated warning
    if(!textBox){that.log.warn(that.id +': Please upgrade this component');}

    //Global variables
    // var center_x = bargraph_area.getBBox().width / 2;       //x-ova souradnice stredu 
    // var center_y = bargraph_area.getBBox().height / 2;      //y-ova souradnice stredu
    var textBoxBBox = null;    
    var font_size_units = 24;
    var font_size_digitalval = 24;
    var tick_counter = 0;
    var tick_height;
    var tick_width;
    var labels = new Array();
    var colorRanges = new Array();
    var zoneCounter = 0;
    var initComponentDone = false;

    //Set level color
    stopC1.style.stopColor = levelColor1;
    stopC2.style.stopColor = levelColor2;

    // GetBBox methods is used here, init can be done when the getBBox is available    
    function initComponent(){
        if(initComponentDone){return;}
        if(!that.testBBox()){return;}

        var centerXDBox = textBox.getBBox().x + textBox.getBBox().width / 2;
        // var centerYDBox = textBox.getBBox().y + textBox.getBBox().height / 2;

        //Set units
        units.textContent = o_units;
        units.setAttributeNS(null, "style", "font-size:" + font_size_units + "px; fill:#ffffff; font-family:Arial");
        units.parentNode.setAttributeNS(null, "transform", 
                "translate(" + parseInt((centerXDBox - units.parentNode.getBBox().width / 2) - units.parentNode.getBBox().x) + "," + 0 +")");                

        //Set digital value
        digitalValue.setAttributeNS(null, "style", "font-size:" + font_size_digitalval + "px; font-family:Arial");

        // Draw ticks
        //tick_counter = (Math.abs(1000000 * r_max - 1000000 * r_min) / 1000000 / tick_step);
        tick_counter = (Math.abs(r_max - r_min) / tick_step);
        tick_height = 1.2;
        tick_width = 20;
        var i = 0;
        while (i <= tick_counter + 0.1) {
            createTick(i, tick_height, tick_width);
            i = i + 1;
        }

        //Draw main ticks
        //var tick_counter = (Math.abs(1000000 * r_max - 1000000 * r_min) / 1000000 / main_tick_step);
        //alert(Math.abs(1000000 * r_max - 1000000 * r_min) / 1000000 / main_tick_step);
        tick_counter = (Math.abs(r_max - r_min) / main_tick_step);
        tick_height = 1.6;
        tick_width = 40;
        var i = 0;
        while (i <= tick_counter + 0.1) {
            createTick(i, tick_height, tick_width);
            createLabel(i);
            i = i + 1;
        }
        //Draw color range
        for (var n = 0; n < colorZones.length; n++) {
            drawColorRange(parseFloat(colorZones[n].startValue), parseFloat(colorZones[n].endValue), colorZones[n].color);
        }
        initComponentDone = true;
    };
    

    // Add anonymous function as event listener. There are two events
    // 'read' - it is called every time when item is read
    // 'change' - called for the first time and every time item value is changed    
        that.$c.value.on('change', function (itm) {
            initComponent();
            if(!initComponentDone){return;}

            var level = itm.getValue();            
            if (level >= r_min && level <= r_max) {
                bargraph_level.setAttributeNS(null, "height", (bargraph_capacity.getBBox().height) * (level - r_min) / Math.abs(r_max - r_min));
                border.style.fill = "#000000";
                digitalValue.style.fill = "#00ffff";
            } else {
                if (level > r_max) {
                    bargraph_level.setAttributeNS(null, "height", bargraph_capacity.getBBox().height);
                    digitalValue.style.fill = colorOffLimits;
                    border.style.fill = colorOffLimits;
                    /*
                    while (r_max <= level) {
                        var tmp = r_min;
                        r_min = r_min + 0.5 * Math.abs(r_max - tmp);
                        r_max = r_max + 0.5 * Math.abs(r_max - tmp);
                    }
                    changeLabels();
                    changeColorRange();
                    bargraph_level.setAttributeNS(null, "height", (bargraph_capacity.getBBox().height) * (level - r_min) / Math.abs(r_max - r_min));
                    digitalval.style.fill = "#00ffff";
                    */
                } else {
                    bargraph_level.setAttributeNS(null, "height", 0.001);
                    digitalValue.style.fill = colorOffLimits;
                    border.style.fill = colorOffLimits;
                    /*
                    while (r_min >= level) {
                        var tmp = r_min;
                        r_min = r_min - Math.abs(r_max - tmp);
                        r_max = r_max - Math.abs(r_max - tmp);
                    }
                    changeLabels();
                    changeColorRange();
                    bargraph_level.setAttributeNS(null, "height", (bargraph_capacity.getBBox().height) * (level - r_min) / Math.abs(r_max - r_min));
                    digitalval.style.fill = "#00ffff";
                    */
                }   
            }
            digitalValue.textContent = level.toFixed(decimals);
            transformDisplay();
        });

    function createTick(i,tick_height,tick_width) {
        var x = bargraph_capacity.getBBox().x - tick_width;
        var y = (bargraph_capacity.getBBox().y + bargraph_capacity.getBBox().height) - i * bargraph_capacity.getBBox().height / tick_counter - tick_height/2;
        var elem = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        elem.setAttributeNS(null, "x", x);
        elem.setAttributeNS(null, "y", y);
        elem.setAttributeNS(null, "width", tick_width);
        elem.setAttributeNS(null, "height", tick_height);
        elem.setAttributeNS(null, "style", "fill:#ffffff");
        bargraph_area.appendChild(elem);
    }

    function createLabel(i) {
        var x = bargraph_capacity.getBBox().x - tick_width;
        var y = (bargraph_capacity.getBBox().y + bargraph_capacity.getBBox().height) - i * bargraph_capacity.getBBox().height / tick_counter - tick_height / 2;
        var font_size = 24;
        var translate_x;
        var translate_y;
        var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttributeNS(null, "x", x);
        text.setAttributeNS(null, "y", y);
        text.setAttributeNS(null, "fill", "#ffffff");
        text.setAttributeNS(null, "style", "font-size:" + font_size + "px; font-family:Arial");
        text.textContent = Math.round((r_min + i * main_tick_step) * 10000) / 10000;
        bargraph_area.appendChild(text);
        translate_x = -text.getBBox().width - 3;
        translate_y = text.getBBox().height / 2 - 3;
        text.setAttributeNS(null, "transform", "translate(" + translate_x + "," + translate_y + ")")
        labels[i] = text;
    }

    function changeLabels() {
        var translate_x;
        var translate_y;
        for (var i = 0; i < labels.length; i++) {
            labels[i].textContent = Math.round((r_min + i * parseFloat(main_tick_step)) * 100) / 100;
            translate_x = -labels[i].getBBox().width - 3;
            translate_y = labels[i].getBBox().height / 2 - 3;
            labels[i].setAttributeNS(null, "transform", "translate(" + translate_x + "," + translate_y + ")")
        }
    }

    function drawColorRange(startValue, endValue, color) {
        var start = startValue;
        var end = endValue;
        if (start < r_min) start = r_min;
        if (end > r_max) end = r_max;
        var startHeight = (bargraph_capacity.getBBox().height) * (start - r_min) / Math.abs(r_max - r_min);
        var endHeight = (bargraph_capacity.getBBox().height) * (end - r_min) / Math.abs(r_max - r_min);
        var x = bargraph_capacity.getBBox().x + bargraph_capacity.getBBox().width + 1;
        var y = bargraph_capacity.getBBox().y + bargraph_capacity.getBBox().height - endHeight;

        var rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            rect.setAttributeNS(null, "style", "fill:" + color + "; stroke:none");
            rect.setAttributeNS(null, "x", x);
            rect.setAttributeNS(null, "y", y);
            rect.setAttributeNS(null, "height", endHeight - startHeight);
            rect.setAttributeNS(null, "width", 8);
            bargraph_area.appendChild(rect);
            colorRanges[zoneCounter] = new colorRangeObject(rect, startValue, endValue, color);
            zoneCounter++;
    }

    function changeColorRange() {
        for (var j = 0; j < colorRanges.length; j++) {
            var start = colorRanges[j].start;
            var end = colorRanges[j].end;
            if (start < r_min) start = r_min;
            if (end > r_max) end = r_max;
            var startHeight = (bargraph_capacity.getBBox().height) * (start - r_min) / Math.abs(r_max - r_min);
            var endHeight = (bargraph_capacity.getBBox().height) * (end - r_min) / Math.abs(r_max - r_min);
            var x = bargraph_capacity.getBBox().x + bargraph_capacity.getBBox().width + 1;
            var y = bargraph_capacity.getBBox().y + bargraph_capacity.getBBox().height - endHeight;
            colorRanges[j].cRObject.setAttributeNS(null, "x", x);
            colorRanges[j].cRObject.setAttributeNS(null, "y", y);
            colorRanges[j].cRObject.setAttributeNS(null, "height", endHeight - startHeight);
        }
    }

    function colorRangeObject(cRObject, start, end, color) {
        this.cRObject = cRObject;
        this.start = start;
        this.end = end;
        this.color = color;
    }

    function transformDisplay() {                
        if (textBox) {            
            var fontSize = digitalValue.style.fontSize || digitalValue.parentNode.style.fontSize;
            if (digitalValue.parentNode.getBBox().width >= textBox.getBBox().width * 0.95) {
                digitalValue.style.fontSize = parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 0.90 + "px";
            }
            else if (digitalValue.parentNode.getBBox().width < textBox.getBBox().width * 0.80
                && parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 1.05 < fSize) {
                digitalValue.style.fontSize = parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 1.05 + "px";
            }

            digitalValue.parentNode.setAttributeNS(null, "transform", "translate("
                + parseInt(textBox.getBBox().x + (textBox.getBBox().width / 2
                    - digitalValue.parentNode.getBBox().width / 2)
                    - digitalValue.parentNode.getBBox().x)
                + "," + parseInt(textBox.getBBox().y +
                    (textBox.getBBox().height / 2 - digitalValue.parentNode.getBBox().height / 2)
                    - digitalValue.parentNode.getBBox().y) + ")");
        }
    }
    
    initComponent();
    that.disable(true);
    return that;
};

REX.UI.SVG.Battery = function(svgElem,args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem,args);
    // Store options for simple usage
    var $o = that.options || {};
    
    var overlay = $(that.getChildByTag("overlay"));
    
    // Get SVG elements for manipulation
    var levels = {
        10:  $(that.getChildByTag("batt-10")),
        25:  $(that.getChildByTag("batt-25")),
        40:  $(that.getChildByTag("batt-40")),
        55:  $(that.getChildByTag("batt-55")),
        70:  $(that.getChildByTag("batt-70")),
        85:  $(that.getChildByTag("batt-85")),
        95: $(that.getChildByTag("batt-100"))
    }   
    $.each( levels, function( key, level ) {        
        level.fill = level.css('fill');        
    });            
    var init = true;
    
    that.$c.value.on('change', function(itm) {        
        if(init){overlay.hide();init=false;}        
        var value = itm.getValue();           
        $.each( levels, function( key, level ) {
            if(value>=key){
                level.css('fill',level.fill);
            }
            else{
                level.css('fill','none');
            }           
        });        
    });

    

    return that;
};

/**
 * SVG component represents Button.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT} 
 * @returns {REX.UI.SVG.Fan} New SVG Button component
 */
REX.UI.SVG.Button = function(svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.HTMLComponent(svgElem, args);
    var $o = that.options || {};    
    
    var type = that.check($o.type,'PushButton');
    var onMouseDownValue = that.parseBoolean($o.reverseMeaning) ? 0 : 1;
    var colorFalse = that.check($o.colorFalse, "#FFFFFF");
    var colorTrue = that.check($o.colorTrue, that.COLORS.primary);
    
    var fontScale = that.checkNumber($o.fontScale, 1);
    var elementTitle = $(that.element).find('title').text();    

    var labelFalse = that.crlf2br(that.check($o.labelFalse, ""));
    var labelTrue = that.crlf2br(that.check($o.labelTrue, labelFalse));
    if (labelTrue.length === 0) {
        labelTrue = labelFalse;
    }
    var labelColorFalse = that.check($o.labelColorFalse, '#000000');
    var labelColorTrue = that.check($o.labelColorTrue, '#FFFFFF');

    // Stavove promenne
    var pressed = false;
    var active = false;

    var button = $(document.createElement('button'));            
    button.addClass('mdc-button mdc-button--raised rex__button');    
    $(that.div).append(button);
    button[0].addEventListener("contextmenu", (e) => { e.preventDefault(); return false; });
    that.div.addEventListener("contextmenu", (e) => { e.preventDefault(); return false; });

    // Heuristika. Pokud neni pro MP definovan cteci bod, pak se bude pouzivat pouze label a color False
    if(!that.$c.refresh_from && (type === 'ManualPulse' || type === 'ManualPulseRpt')){
        labelTrue = labelFalse;
        colorTrue = colorFalse;
        labelColorTrue = labelColorFalse;
    }
    // Defaultni nastaveni textu pro tlacitko
    button.html(labelTrue);

    // Add `write` and `refresh` functions. Necessary for all write components 
    // with *value* and  *refresh_from* items.
    that.addWriteInterface();

    var oldDisable = that.disable;
    that.disable = function () {
        oldDisable.apply(that,arguments);
        // button.css("background", "");
        // button.css("color", "");
        button.attr("disabled",true);        
        button.css('pointer-events','none');
        pressed = false;
        that.refresh();
    };

    var oldEnable = that.enable;    
    that.enable = function () {
        // Enable only if enable is allowed
        if(oldEnable.apply(that, arguments)){
            button.removeAttr("disabled");
            button.css('pointer-events', '');    
            that.refresh();
        }        
    };

    var oldHide = that.hide;
    that.hide = function () {
        oldHide.apply(that,arguments);
        pressed = false;
    };
    
    // Init font autoresize+
    function updateFontSize() {
        var ctm = that.svg.getScreenCTM();
        // Scale according the width or height which is better
        if (ctm) {
            button.css('font-size', 16*Math.min(ctm.a, ctm.d) * fontScale + 'px');
            button.css('line-height', 16*Math.min(ctm.a, ctm.d) * fontScale + 'px');
        }
    }

    $(window).on('resize orientationchange', function () {
        updateFontSize();
    });

    updateFontSize();

    if (type === 'ToggleButton' && that.$c.value !== that.$c.refresh_from) {
        that.log.error(`Refresh_from datapoint is not supported in the Toggle mode!`);
        that.refresh();
        that.disable();
        // Vypne funkci enable a ukonci ostatni inicializace
        that.enable=function(){};
        return that;
    }

    that.refresh = function(){
        let value = that.$c.refresh_from.getValue();
        if (value === (1 - onMouseDownValue) || value === null) {
            button.css("background", colorFalse);
            // jQuery is not able to change important flag
            button[0].style.setProperty('color', labelColorFalse, 'important');
            button.html(labelFalse);
            active = false;
        }
        else {
            button.css("background", colorTrue);
            button[0].style.setProperty('color', labelColorTrue, 'important');
            button.html(labelTrue);
            active = true;
        }
    };

    let loopWrite = function () {
        that.$c.value.write(onMouseDownValue)
            .then(() => {
                setTimeout(() => {
                    if (pressed) {
                        loopWrite();
                    }
                }, 20);
            })
            .catch(that.writeFailed);
    };

    button.bind('touchstart mousedown', function(evt) {
        evt.preventDefault(); 
        this.focus();
        if (evt.handled !== true) {
            // Primary mouse button only            
            if (!(evt.button && evt.button > 0)) {                
                if (type === 'ToggleButton') {
                    if (!active) {
                        that.write(onMouseDownValue);
                        active = true;
                    }
                    else {
                        that.write(1 - onMouseDownValue);
                        active = false;
                    }
                }
                else if (type === 'ManualPulseRpt') {
                    loopWrite();
                    that.log.debug(labelFalse + ' ' + evt.type);
                }
                else {
                    that.log.debug(labelFalse + ' ' + evt.type);
                    that.write(onMouseDownValue);
                }
                pressed = true;
                that.emit('mousedown');                
            }
            evt.handled = true;
        } else {
            return false;
        }
    })
    .bind('touchend touchcancel touchleave mouseup mouseleave', function(evt) {
        evt.preventDefault();
        this.blur();
        if (evt.handled !== true) {
            // Primary mouse button only       
            // Invoke only when the button was pressed before
            if (!(evt.button && evt.button > 0) && pressed) {
                that.log.debug(labelFalse + ' ' + evt.type);
                if (type === 'PushButton') {
                    that.write(1 - onMouseDownValue);
                }
                that.emit('mouseup');
                pressed = false;
            }
            evt.handled = true;
        } else {
            return false;
        }
    });

    that.setReadOnly = function(){
        that.readOnly = true;   
        pressed = false;     
        button.addClass('rex__button--read-only');
        button.off().removeData();
        button.css('pointer-events','none');
    };

    that.refresh();    
    that.disable(true);
    return that;
};
REX.UI.SVG.Checkbox = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem, args);
    // Store options for simple usage
    var $o = that.options || {};

    // Get options or default values
    var reverse_meaning = that.parseBoolean($o.reverse_meaning);
    var show_cross = that.parseBoolean($o.show_cross);

    // Add `write` and `refresh` functions. Necessary for all write components 
    // with *value* and  *refresh_from* items.
    that.addWriteInterface();
 
    // Get SVG elements for manipulation
    var switchArea = that.element,
        tick = SVG.adopt(that.getChildByTag("tick")),
        cross = SVG.adopt(that.getChildByTag("cross")),
        currentPosition = 0;
        
    that.element.addEventListener("click", toggleValue, false);
    that.element.addEventListener("contextmenu", toggleValue, false);
    that.element.style.cursor = 'pointer';

    that.refresh = function() {
        let value = that.$c.refresh_from.getValue();
        if (reverse_meaning) {
            currentPosition = (value === 0) ? 1 : 0;
        }
        else {
            currentPosition = value;
        }

        if (currentPosition === 0) {
            if(show_cross){
                tick.hide();
                cross.show();                
            }
            else{
                tick.hide();
                cross.hide();
            }
        }
        else {
            tick.show();
            cross.hide();
        }
    };

    function toggleValue(event) {
        event.preventDefault();
        if (currentPosition === 0) {
            let val = !reverse_meaning ? 1 : 0;
            that.write(val);
            currentPosition = 1;
        } else {
            let val = reverse_meaning ? 1 : 0;
            that.write(val);
            currentPosition = 0;
        }
        that.refresh();
    }   

    var oldDisable = that.disable;
    that.disable = function () {
        oldDisable.apply(that,arguments);
        // tick.hide();
        // cross.hide();
    };

    var oldEnable = that.enable;
    that.enable = function () {
        if(oldEnable.apply(that, arguments)){
            that.refresh();
        }
    };

    that.setReadOnly = function () {
        that.readOnly = true;
        $(that.element).off().removeData();
        $(that.element).css('pointer-events', 'none');
    };

    return that;
};

/**
 * SVG component represents ComboBox.
 * @param {SVGElement} svgElem
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT}
 * @returns {REX.UI.SVG.ComboBox} New SVG ComboBox component
 */
REX.UI.SVG.ComboBox = function(svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.HTMLComponent(svgElem, args);
    var $o = that.options || {};
    var values = $o.values;
    var showValue = that.parseBoolean($o.showValue);
    var fontScale = that.checkNumber($o.fontScale,1);
    var valueType = (that.check($o.valueType,'number')).toLowerCase();
    var slimSelect = null;
    var isBrowserOnRPi = that.utils.isBrowserOnRPi();

    // Add `write` and `refresh` functions. Necessary for all write components 
    // with *value* and  *refresh_from* items.
    that.addWriteInterface();

    let select = $(document.createElement('select'));
    select.addClass('rex__input rex__select rex__fill');
    select.attr('id', that.element.id);
    $(that.div).append(select);

    for(var i = 0; i<values.length; i++){
        var desc = '';
        if (!values[i].desc) {
            desc = values[i].value;
        }
        else {
            desc = showValue ? values[i].value + ': ' + values[i].desc : values[i].desc;
        }
        select.append('<option value="'+values[i].value+'">'+desc+'</option>');
    }

    // Chromium on RaspberryPi Touch display is not able to show select dropdown list
    // This create a alternative version using SlimSelect library
    function initSlimSelect(){
        if(isBrowserOnRPi){
            if(slimSelect){
                slimSelect.destroy();
            }
            slimSelect = new SlimSelect({
                select: select.get(0),
                showSearch : false
            });
        }        
    }

    if(isBrowserOnRPi){
        select.removeClass('rex__input');
        initSlimSelect();
    }
    
    select.change(function () {
        var val = $(this).val();
        if (valueType === 'number') {
            val = parseFloat(val);
        }
        that.write(val);
    });

    var firstRefresh = true;
    that.refresh = function (){
        var value = that.$c.refresh_from.getValue();
        if(value === null){
            return;
        }        
        if (select.find('option[value="' + value + '"]').length == 0) {
            select.append('<option value="' + value + '">'+value+'</option>');
            initSlimSelect();
            firstRefresh = true;
        }
        if(slimSelect){
            slimSelect.set(value.toString());
        }
        else{
            select.val(value.toString());
        }         
        if(firstRefresh){
            that.updatePosition();
            firstRefresh = false;
        }
    };

    if(that.$c.values){
        that.$c.values.on('change', function (itm) {
            let values = itm.getValue();
            if(typeof values !== 'string'){                
                that.log.warn('Datapoint `values` is not a string');
                return;
            }
            if(values.length === 0){
                select.empty();
                return;    
            }                        
            if(values.indexOf(':') === -1){
                that.log.warn('Datapoint values string is not well formatted. It should contain list of values/descriptions separated by | eg. "0: NOK | 1: OK"');
                return;
            }
            values = values.split('|');
            select.empty();
            for(let i = 0; i<values.length; i++){
                let split = values[i].split(':');
                let desc = '';
                if (!split[1]) {
                    desc = split[0];
                }
                else {
                    desc = showValue ? split[0] + ': ' + split[1] : split[1];
                }
                select.append('<option value="'+split[0]+'">'+desc+'</option>');
            }  
            initSlimSelect();          
            that.refresh();
        });        
    }

    var oldUpdatePosition = that.updatePosition;
    that.updatePosition = function(){
        oldUpdatePosition.apply(that,arguments);
        updateFontSize();
    };

    // Init font autoresize
    function updateFontSize() {
        var ctm = that.svg.getScreenCTM();
        if(ctm){ // V pripade, ze se funkce vola moc brzo, tak neni dostupna transformace
            let fontSize = Math.min(ctm.a, ctm.d) * fontScale + 'em';
            // Scale according the width or height which is better
            select.css('font-size', fontSize);
            if(slimSelect){
                $(that.div).find('.ss-main').css('font-size', fontSize);
            }
        }        
    }

    var oldDisable = that.disable;
    that.disable = function () {
        oldDisable.apply(that,arguments);                
        select.attr("disabled",true);
        select.css('pointer-events','none');
        if(slimSelect){
            slimSelect.disable();
        }
        that.refresh();
    };

    var oldEnable = that.enable;
    that.enable = function () {
        // Enable only if enable is allowed
        if(oldEnable.apply(that, arguments)){            
            select.removeAttr("disabled");
            select.css('pointer-events', '');    
            if(slimSelect){
                slimSelect.enable();
            }
            that.refresh();
        }        
    };

    that.setReadOnly = function(){
        that.readOnly = true;        
        select.addClass('rex__input--read-only');
        select.off().removeData();
        select.css('pointer-events','none');
    };

    that.disable(true);
    that.updatePosition();
    return that;
};
/**
 * SVG component represents control led
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT} 
 * @returns {REX.UI.SVG.ControlLed} New Control Led component
 */
REX.UI.SVG.ControlLed = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem, args);
    // Store options for simple usage
    var $o = that.options || {};

    // Load options or default values
    $o.color_true = $o.color_true || $o.colorRun || "#33ee00";
    $o.color_false = $o.color_false || $o.colorStop || "#ffffff";

    var colorTrue = that.parseBoolean($o.reverseMeaning) ? $o.color_false : $o.color_true;
    var colorFalse = that.parseBoolean($o.reverseMeaning) ? $o.color_true : $o.color_false;

    // Get SVG elements for manipulation
    var oled1 = that.getChildByTag('radialgradient-start');
    var oled2 = that.getChildByTag('radialgradient-stop');
    var radialGradientId = that.getChildByTag('radialgradient').id;
    var path = that.getChildByTag('path');

    path.style.fill = "url(#" + radialGradientId + ")";

    // For backward compatibility
    that.$c.value = that.$c.value || that.$c.LIGHT;

    that.$c.value.on('change', function (i) {
        if (!that.isDisabled()) {
            refresh();
        }
    });

    // HACK: Chrome neumi spravne zobrazit gradienty, pokus se zaroven pouziva funkce hide
    // Je to popsano v teto chybe https://bugs.chromium.org/p/chromium/issues/detail?id=769774
    var isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

    function refresh() {
        if (that.$c.value.getValue()) {
            oled1.style.stopColor = colorTrue;
            oled2.style.stopColor = colorTrue;
            if (isChrome) { // HACK: Viz vyse
                path.style.fill = colorTrue;
            }
        } else {

            oled1.style.stopColor = colorFalse;
            oled2.style.stopColor = colorFalse;
            if (isChrome) { // HACK: Viz vyse
                path.style.fill = colorFalse;
            }
        }
    }

    var oldDisable = that.disable;
    that.disable = function () {
        oldDisable.apply(that, arguments);
        oled1.style.stopColor = "#ffffff";
        oled2.style.stopColor = "#7f7f7f";
        if (isChrome) { // HACK: Viz vyse
            path.style.fill = "#7f7f7f";
        }
    };

    var oldEnable = that.enable;
    that.enable = function () {
        if(oldEnable.apply(that, arguments)){
            refresh();
        }
    };

    return that;

};




REX.UI.SVG.CustomHTML = function(svgElem, args) {
     // Inherit from base component
    var that = new REX.UI.SVG.HTMLComponent(svgElem, args);
    var $o = that.options || {};
    var html = $o.html;

    $(that.div).html(html);

    return that;
};
/**
 * SVG component represents Display.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT}
 * @returns {REX.UI.SVG.Fan} New SVG Display component
 */
REX.UI.SVG.Display = function (svgElem, args) {    
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem, args);
    // Store options for simple usage
    var $o = that.options || {};

    // Load options or default values
    var range_min = that.checkNumber($o.rangeMin, 0);
    var range_max = that.checkNumber($o.rangeMax, 100);
    var color_max = $o.colorAbove || '#ff0000';
    var color_min = $o.colorBelow || '#ffff00';
    var color = $o.color || "black";
    var format = $o.format || '';
    var text_format = $o.text_format || '';
    var scale = that.checkNumber($o.scale, 1);
    var offset = that.checkNumber($o.offset, 0);
    var decimals = that.checkNumber($o.decimals, 4);
    var units = $o.units || '';

    // Get SVG elements for manipulation
    var display = that.getChildByTag("display");

    // For backward compatibility with 2.10.8
    if (!display) {
        display = that.getChildByTag("number");
    }

    // If tspan exist used it
    if($(display).find('tspan').length>0){
        display = $(display).find('tspan').get(0);
    }

    if (!display) {        
        that.log.warn('Display ' + that.id + ' is not valid component');
        return
    }
    
    that.$c.value.on('change', function (itm) {
        switch (format.toLowerCase()) {
            case 'text':
                if(text_format){
                    if(text_format.indexOf("hh:mm")!==-1){
                        display.textContent = that.time2str(itm.getValue(),text_format);
                    }
                }
                // TODO: Add more text formats
                else{
                    display.textContent = itm.getValue();
                }
                break;
            case 'date':
                display.textContent = that.date2str(that.getDateFromREXSeconds(itm.getValue()));
                break;
            case 'time':
                display.textContent = that.getDateFromREXSeconds(itm.getValue()).toLocaleTimeString();
                break;
            case 'datetime':
                display.textContent = that.date2str(that.getDateFromREXSeconds(itm.value)) + ' ' +
                        that.getDateFromREXSeconds(itm.value).toLocaleTimeString();
                break;
            default:
                if (itm.getValue() < range_min) {
                    display.style.fill = color_min;
                } else if (itm.getValue() > range_max) {
                    display.style.fill = color_max;
                } else {
                    display.style.fill = color;
                }
                var resultValue = (itm.value * scale) + offset;                
                display.textContent = '' + resultValue.toFixed(decimals);
                break;
        }
        if(units){
            display.textContent = display.textContent + units;
        }
    });

    return that;
};
/**
 * SVG component represents SimpleLogger.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT} 
 * @returns {DisplayMatrix} New HTML component
 */
REX.UI.SVG.DisplayMatrix = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.HTMLComponent(svgElem, args);
    // var $div = $(that.div);

    var $o = that.options || {};
    var decimals = that.checkNumber($o.decimals, 2);
    var transpose = that.parseBoolean($o.transpose);
    let fontScale = that.checkNumber($o.fontScale, 1);
    let header = $o.header;
    let showLineNumbers = that.parseBoolean($o.showLineNumbers);
    let divClass = $o.divClass;
    let tableClass = $o.tableClass;

    let initfontSize = '1em';
    let rowsOld = -1;
    let colsOld = -1;
    let tableCells = [];
    let rows, cols;
    
    that.div.style.overflow = 'auto';
    that.div.className += ' ' + divClass;

    let table = document.createElement('table');
    table.style.fontSize = initfontSize;
    table.className += ' ' + tableClass;

    that.$c.value.once('browse', function (itm) {
        if (itm.kind.kindName === 'arr') {
            that.$c.value.on('read', refresh);
        } else {
            this.log.warn(`Datapoint ${that.$c.value.cstring} is not an array! ${that.title} will be disabled.`);
            that.disable();
        }
    });

    function refresh() {
        let arr = that.$c.value.getValue();
        cols = arr.length;
        rows = arr[0].length || 1;
        if (transpose) {
            let tmpRows = rows;
            rows = cols;
            cols = tmpRows;
        }
        if (rows !== rowsOld || cols != colsOld) {
            // Reinit HTML table
            table.innerHTML = '';

            if(header.length > 0){
                let thead = document.createElement('thead');
                table.appendChild(thead);
                if(header.length != cols){
                    that.log.warn('Number of header labels do not match number of columns.');
                }
                let tr = document.createElement('tr');
                thead.appendChild(tr);

                if(showLineNumbers){
                    let th = document.createElement('th');
                    th.innerText = "";
                    tr.appendChild(th);
                }

                for(let i=0; i < cols; i++){
                    let th = document.createElement('th');
                    th.innerText = header[i] ? header[i].label : "";
                    tr.appendChild(th);
                }    
            }

            let tbody = document.createElement('tbody');
            table.appendChild(tbody);

            tableCells = [];
            for (let i = 0; i < rows; i++) {
                let tr = document.createElement('tr');
                let trArr = [];

                if (showLineNumbers) {
                    let td = document.createElement('td');
                    td.style.textAlign = 'right';
                    td.innerText = '' + (i + 1);
                    tr.appendChild(td);
                }
                for (let j = 0; j < cols; j++) {
                    let td = document.createElement('td');
                    tr.appendChild(td);
                    trArr.push(td);
                }
                tableCells.push(trArr);
                tbody.appendChild(tr);
            }
            rowsOld = rows;
            colsOld = cols;
            that.div.appendChild(table);
        }

        for (let i = 0; i < arr.length; i++) { // Columns
            for (let j = 0; j < (arr[0].length || 1); j++) { // Rows
                if (transpose) {
                    tableCells[i][j].innerText = arr[i][j].toFixed(decimals);
                } else {
                    tableCells[j][i].innerText = arr[i][j].toFixed(decimals);
                }
            }
        }
    }

    // Init font autoresize
    function updateFontSize() {
        let ctm = that.svg.getScreenCTM();
        // Scale according the width or height which is better
        if (ctm) {
            let size = Math.min(ctm.a, ctm.d) * fontScale + 'em';
            if (table) {
                table.style.fontSize = size;
            }
            initfontSize = size;
        }
    }


    that.on('updatePosition', () => {
        updateFontSize();
    });

    // // Override disable and enable function
    // var old_disable = that.disable;
    // that.disable = function () {
    //     $div.addClass('ui-state-disabled');
    //     old_disable.apply(this, arguments);
    // };
    // var old_enable = that.enable;
    // that.enable = function () {        
    //     if(old_enable.apply(this, arguments)){
    //         $div.removeClass('ui-state-disabled');
    //     }
    // };

    updateFontSize();
    that.disable(true);
    return that;
};
REX.UI.SVG.DisplayMatrixExt = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.HTMLComponent(svgElem, args);
    // var $div = $(that.div);

    var $o = that.options || {};
    var decimals = that.checkNumber($o.decimals, 2);
    var transpose = that.parseBoolean($o.transpose);
    let fontScale = that.checkNumber($o.fontScale, 1);
    let header = $o.header;
    let showLineNumbers = that.parseBoolean($o.showLineNumbers);
    let divClass = $o.divClass;
    let tableClass = $o.tableClass;
    let transformFcn = null;
    if ($o.transformFcn) {
        try {
            transformFcn = new Function('row', 'column', 'value', $o.transformFcn);
        } catch(err) {
            this.log.debug('Parsing body of the transform function failed.');
            this.log.debug(err);
        }
    }
    

    let initfontSize = '1em';
    let rowsOld = -1;
    let colsOld = -1;
    let tableCells = [];
    let rows, cols;
    
    that.div.style.overflow = 'auto';
    that.div.className += ' ' + divClass;

    let table = document.createElement('table');
    table.style.fontSize = initfontSize;
    table.className += ' ' + tableClass;

    that.$c.value.once('browse', function (itm) {
        if (itm.kind.kindName === 'arr') {
            that.$c.value.on('read', refresh);
        } else {
            this.log.warn(`Datapoint ${that.$c.value.cstring} is not an array! ${that.title} will be disabled.`);
            that.disable();
        }
    });

    if (that.$c.row) {
        that.$c.row.on('change', (itm) => {
            refreshSelectedRow();
        });
    }

    function refreshSelectedRow(){
        if (that.$c.row) {
            let rowIndex = that.$c.row.getValue();
            for(let el of table.querySelectorAll('tr')){
                el.classList.remove('selected');
            }            
            if (that.checkNumber(rowIndex) && rowIndex >= 0) {
                let tr = table.querySelector(`tbody > tr:nth-child(${rowIndex})`);
                if (tr) {
                    tr.classList.add('selected');
                }
            }
        }
    }

    function refresh() {
        let arr = that.$c.value.getValue();
        cols = arr.length;
        rows = arr[0].length || 1;
        if (transpose) {
            let tmpRows = rows;
            rows = cols;
            cols = tmpRows;
        }
        if (rows !== rowsOld || cols != colsOld) {
            // Reinit HTML table
            table.innerHTML = '';

            if(header.length > 0){
                let thead = document.createElement('thead');
                table.appendChild(thead);
                if(header.length != cols){
                    that.log.warn('Number of header labels do not match number of columns.');
                }
                let tr = document.createElement('tr');
                thead.appendChild(tr);

                if(showLineNumbers){
                    let th = document.createElement('th');
                    th.innerText = "";
                    tr.appendChild(th);
                }

                for(let i=0; i < cols; i++){
                    let th = document.createElement('th');
                    th.innerText = header[i] ? header[i].label : "";
                    tr.appendChild(th);
                }    
            }

            let tbody = document.createElement('tbody');
            table.appendChild(tbody);

            tableCells = [];
            for (let i = 0; i < rows; i++) {
                let tr = document.createElement('tr');
                let trArr = [];

                if (showLineNumbers) {
                    let td = document.createElement('td');
                    td.style.textAlign = 'right';
                    td.innerText = '' + (i + 1);
                    tr.appendChild(td);
                }
                for (let j = 0; j < cols; j++) {
                    let td = document.createElement('td');
                    tr.appendChild(td);
                    trArr.push(td);
                }
                tableCells.push(trArr);
                tbody.appendChild(tr);
            }
            rowsOld = rows;
            colsOld = cols;
            that.div.appendChild(table);
        }

        for (let i = 0; i < arr.length; i++) { // Columns
            for (let j = 0; j < (arr[0].length || 1); j++) { // Rows
                let value = transformFcn ? transformFcn(j, i, arr[i][j]) : arr[i][j].toFixed(decimals);
                if (transpose) {
                    tableCells[i][j].innerText = value;
                } else {
                    tableCells[j][i].innerText = value;
                }
            }
        }
        refreshSelectedRow();
    }

    // Init font autoresize
    function updateFontSize() {
        let ctm = that.svg.getScreenCTM();
        // Scale according the width or height which is better
        if (ctm) {
            let size = Math.min(ctm.a, ctm.d) * fontScale + 'em';
            if (table) {
                table.style.fontSize = size;
            }
            initfontSize = size;
        }
    }


    that.on('updatePosition', () => {
        updateFontSize();
    });

    // // Override disable and enable function
    // var old_disable = that.disable;
    // that.disable = function () {
    //     $div.addClass('ui-state-disabled');
    //     old_disable.apply(this, arguments);
    // };
    // var old_enable = that.enable;
    // that.enable = function () {        
    //     if(old_enable.apply(this, arguments)){
    //         $div.removeClass('ui-state-disabled');
    //     }
    // };

    updateFontSize();
    that.disable(true);
    return that;
};
/**
 * SVG component represents DisplayString.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT}
 * @returns {REX.UI.SVG.DisplayString} New SVG DisplayString component
 */
REX.UI.SVG.DisplayString = function (svgElem, args) {    
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem, args);
    // Store options for simple usage
    var $o = that.options || {};

    // Load options or default values    
    var format = ($o.format || '').toLowerCase();
    var showValue = that.parseBoolean($o.showValue);
    var values = {};

    if (format == 'alt') {
        var valuesArr = $o.values;
        // Convert value array to dictionary
        for (var i = 0; i < valuesArr.length; i++) {
            var desc = '';
            if (!valuesArr[i].desc) {
                desc = valuesArr[i].value;
            }
            else {
                desc = showValue ? valuesArr[i].value + ': ' + valuesArr[i].desc : valuesArr[i].desc;
            }
            values[valuesArr[i].value] = desc;
        }
    }
    
    // Get SVG elements for manipulation
    var display = SVG.adopt(that.getChildByTag("display"));

    if (!display) {
        that.log.warn('Display ' + that.id + ' is not valid component');
        return;
    }

    // Change line-height for multiline strings
    var $d = $(that.getChildByTag("display"));
    var leading = parseFloat($d.css('line-height')) / parseFloat($d.css('font-size'));
    display.leading(leading);

    
    that.$c.value.on('change', function (itm) {
        var val = itm.getValue();
        
        // V pripade napojeni na chybovy vystum REXLANGu se posila objekt {error:0, text:"Popis chyby""}
        if (typeof val === 'object') {
            if (val.error != null) {
                val = showValue ? `${val.error}: ${val.text}` : `${val.text}`;
            } else {
                val = JSON.stringify(val);
            }
        }
        // Convert to string
        val = '' + val;
        display.clear();
        if (val.length > 0) {
            switch (format.toLowerCase()) {
                case 'alt':                
                        display.text(values[val] || val);                
                    break;
                default:
                        display.text(val);
                    break;
            }
        }
    });

    return that;
};
/**
 * SVG component represents DisplayWithBox.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT}
 * @returns {REX.UI.SVG.DigitalValue} New SVG DigitalValue component
 */

REX.UI.SVG.DisplayWithBox = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem, args);
    // Store options for simple usage
    var $o = that.options || {};

    // Get options or default values
    var decimals = that.checkNumber($o.decimals,2),
        rangeMin = that.checkNumber($o.rangeMin,0),
        rangeMax = that.checkNumber($o.rangeMax,100),
        colorAbove = $o.colorAbove || '#ff0000',
        colorBelow = $o.colorBelow || '#ffff00',
        color = $o.color || "#00ffff",
        o_units = $o.units || " ";
    var format = $o.format || '';
    var scale = that.checkNumber($o.scale, 1);
    var offset = that.checkNumber($o.offset, 0);

    // Get SVG elements for manipulation
    var digitalvalue_area = that.getChildByTag("digitalval_area"),
        digitalValue = that.getChildByTag("digitalval"),
        textBox = that.getChildByTag("textbox"),
        text = that.getChildByTag("text"),
        units = that.getChildByTag("units");

    //Set units
    units.textContent = o_units;    

    function resizeFont() {
        var fontSize = digitalValue.style.fontSize;
        var center_x, dvBB, tbBB, unitsBB;
        try {
            center_x = digitalvalue_area.getBBox().width / 2;
            dvBB = digitalValue.parentNode.getBBox(),
                tbBB = textBox.getBBox();
            unitsBB = units.parentNode.getBBox();
        } catch (error) {
            // Resize font failed if element is display:none            
            // getBBox() failed
            return;
        }

        units.parentNode.setAttributeNS(null, "transform", "translate(" + parseInt(
            (center_x - unitsBB.width / 2) - unitsBB.x) + "," + 0 + ")");

        // Change font size        
        if (dvBB.width >= tbBB.width * 0.95) {
            digitalValue.style.fontSize = parseFloat(
                fontSize.substring(0, fontSize.indexOf('p'))) * 0.9 + "px";
        } else if (dvBB.width < tbBB.width * 0.9 && dvBB.height < tbBB.height) {
            digitalValue.style.fontSize = parseFloat(
                fontSize.substring(0, fontSize.indexOf('p'))) * 1.1 + "px";
        }
        // Center text
        digitalValue.parentNode.setAttributeNS(null, "transform",
            "translate(" + parseInt(
                (digitalvalue_area.getBBox().width / 2 - dvBB.width / 2) - dvBB.x) +
            "," + 0 + ")");
    }
    
    that.$c.value.on('change', function (itm) {
        switch (format.toLowerCase()) {
            case 'date':
                digitalValue.textContent = that.date2str(that.getDateFromREXSeconds(itm.value));
                break;
            case 'time':
                digitalValue.textContent = that.getDateFromREXSeconds(itm.value).toLocaleTimeString();
                break;
            case 'datetime':
                digitalValue.textContent = that.date2str(that.getDateFromREXSeconds(itm.value)) + ' ' +
                        that.getDateFromREXSeconds(itm.value).toLocaleTimeString();
                break;
            default:
                if (itm.getValue() < rangeMin) {
                    digitalValue.style.fill = colorBelow;
                }
                else if (itm.getValue() <= rangeMax) {
                    digitalValue.style.fill = color;
                }
                else {
                    digitalValue.style.fill = colorAbove;
                }
                var resultValue = (itm.getValue() * scale) + offset;                                
                digitalValue.textContent = resultValue.toFixed(decimals);
                break;
        }
        resizeFont();
    });
    
    resizeFont();

    return that;
};

/**
 * SVG component represents Gauge.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT}
 * @returns {REX.UI.SVG.Gauge} New SVG Gauge component
 */
REX.UI.SVG.Gauge180 = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem, args);
    // Store options for simple usage
    var $o = that.options || {};

    // Load options or default values
    var r_min = that.checkNumber($o.rangeMin, 0); //minimum rozsahu
    var r_max = that.checkNumber($o.rangeMax, 1); //maximum rozsahu
    var tick_step = that.check($o.tickStep, 5); //krok maleho tiku
    //krok hlavniho tiku s oznacenim
    var main_tick_step = that.check($o.mainTickStep,10);
    //pocet desetinnych mist pro zaokrouhleni digitalni hodnoty
    var decimals = that.check($o.decimals||$o.digitalPrecision,2);
    var o_units = $o.units || " ";                  //jednotky
    var colorZones = $o.colorZones || null;         //barevne rozsahy
    var colorOffLimits = $o.colorOffLimits || "#ff7400";
    var fSize = 28;

    // Get SVG elements for manipulation
    var gauge_area = that.getChildByTag("gauge_area");   //cely objekt
    var hand = that.getChildByTag("hand");               //rucicka
    var middle_circle = that.getChildByTag("middle");    //kruhovy stred
    var border = that.getChildByTag("border");           //okraj
    var tick_0 = that.getChildByTag("tick_0");           //maly tik v pocatku
    var main_tick_0 = that.getChildByTag("main_tick_0"); //hlavni oznaceny tik v pocatku
    var digitalValue = that.getChildByTag("digitalval");   //digitalni hodnota
    var units = that.getChildByTag("units");             //jednotky
    var textBox = that.getChildByTag("text_box");        // prostor pro vykresleni hodnoty
    // Deprecated warning
    if(!textBox){that.log.warn(that.id +': Please upgrade this component');}

    //Global variables
    var center_x = null;     //x-ova souradnice stredu 
    var center_y = null;     //y-ova souradnice stredu;
    var font_digitalval = 24;
    var main_tick_size = 5;
    var main_tick_color = "#ffffff";
    var tick_counter;               //pocet malych tiku
    var main_tick_counter;          //pocet hlavnich oznacenych tiku                          
    var tick_angle;                 //uhel mezi jednotlivymi tiky
    var labels = new Array();       //pole hodnot pro popis osy

    var initComponentDone = false;

    // GetBBox methods is used here, init can be done when the getBBox is available    
    function initComponent() {
        if(initComponentDone){return;}
        if(!that.testBBox()){return;}

        center_x = gauge_area.getBBox().width / 2;     //x-ova souradnice stredu 
        center_y = gauge_area.getBBox().height - middle_circle.getBBox().height / 2 - 1;     //y-ova souradnice stredu;    

        //Fill color, opacity, size
        tick_0.setAttributeNS(null, "style", "fill:#ffffff");
        main_tick_0.setAttributeNS(null, "style", "fill-opacity:0");
        tick_0.setAttributeNS(null, "height", tick_0.getBBox().height / 2);
        tick_0.setAttributeNS(null, "y", tick_0.getBBox().y + tick_0.getBBox().height * 2 / 2 - tick_0.getBBox().height / 2);
        hand.setAttributeNS(null, "style", "fill-opacity:1");

        //Set units
        units.textContent = o_units;
        units.parentNode.setAttributeNS(null, "transform", "translate(" + parseInt((center_x - units.parentNode.getBBox().width / 2) - units.parentNode.getBBox().x) + "," + 10 + ")");

        //Draw ticks
        tick_counter = (Math.abs(r_max - r_min)) / tick_step;
        tick_angle = 180 / tick_counter;
        var i = 0;
        while (i <= tick_counter) {
            createTick(i, "#"+ tick_0.id);
            i = i + 1;
        }
        //Draw main ticks
        main_tick_counter = (Math.abs(r_max - r_min)) / main_tick_step;
        tick_angle = 180 / main_tick_counter;
        i = 0;
        while (i <= main_tick_counter) {
            //createTick(i, "#main_tick_0");
            createLabel(i);
            createMainTick(i);
            i = i + 1;
        }

        //Draw color range
        for (var n = 0; n < colorZones.length; n++){
            drawColorRange(parseFloat(colorZones[n].startValue), parseFloat(colorZones[n].endValue), colorZones[n].color);
        }

        // Change z-index on the top
        hand.parentNode.appendChild(hand);                   //posunuti rucicky v hierarchii uplne nahoru
        middle_circle.parentNode.appendChild(middle_circle); //posunuti kruhoveho stredu v hierarchii uplne nahoru
        digitalValue.setAttributeNS(null, "style", "font-size:" + font_digitalval + "px");

        initComponentDone = true;
    };

    // Add anonymous function as event listener. There are two events
    // 'read' - it is called every time when item is read
    // 'change' - called for the first time and every time item value is changed    
    that.$c.value.on('change', function (itm) {
        initComponent();
        if(!initComponentDone){return;}
        
        var value = itm.getValue();
        var angle = (value - r_min) * (180 / Math.abs(r_max - r_min)) - 90;
        if (value >= r_min && value <= r_max) {
            hand.setAttributeNS(null, "transform", "rotate(" + angle + "," + center_x + "," + center_y + ")");
            digitalValue.style.fill = "#00ffff";
            border.setAttributeNS(null, "style", "fill:#000000");
        }

        else {
            if (value > r_max) {

                hand.setAttributeNS(null, "transform", "rotate(" + 90 + "," + center_x + "," + center_y + ")");
                digitalValue.style.fill = colorOffLimits;
                border.style.fill = colorOffLimits;
                /*
                var tmp = r_min;
                r_min = r_min + 0.5 * Math.abs(r_max - tmp);
                r_max = r_max + 0.5 * Math.abs(r_max - tmp);
                changeLabels();
                */
            } else {

                hand.setAttributeNS(null, "transform", "rotate(" + -90 + "," + center_x + "," + center_y + ")");
                digitalValue.style.fill = colorOffLimits;
                border.style.fill = colorOffLimits;
                /*
                var tmp = r_min;
                r_min = r_min - 0.5 * Math.abs(r_max - tmp);
                r_max = r_max - 0.5 * Math.abs(r_max - tmp);
                changeLabels();
                */
            }
        }
        digitalValue.innerHTML = value.toFixed(decimals);
        transformDisplay();
    });

    function createTick(i, tick_type) {
        var mat_a = Math.cos((tick_angle * i) * Math.PI / 180);
        var mat_b = Math.sin((tick_angle * i) * Math.PI / 180);
        var mat_e = (-center_x) * Math.cos((tick_angle * i) * Math.PI / 180) + center_y * Math.sin((tick_angle * i) * Math.PI / 180) + center_x;
        var mat_f = (-center_x) * Math.sin((tick_angle * i) * Math.PI / 180) - center_y * Math.cos((tick_angle * i) * Math.PI / 180) + center_y;

        var elem = document.createElementNS("http://www.w3.org/2000/svg", "use");
        elem.setAttributeNS("http://www.w3.org/1999/xlink", "href", tick_type);
        elem.setAttributeNS(null, "transform", "matrix(" + mat_a + "," + mat_b + "," + -mat_b + "," + mat_a + "," + mat_e + "," + mat_f + ")");
        gauge_area.appendChild(elem);
    }

    function createMainTick(i) {
        var x = center_x + Math.sqrt(center_x / 1.888 * center_x / 1.888 + center_y / 1.888 * center_y / 1.888) * Math.cos((180 - tick_angle * i) * Math.PI / 180);
        var y = center_y - Math.sqrt(center_x / 1.888 * center_x / 1.888 + center_y / 1.888 * center_y / 1.888) * Math.sin((180 - tick_angle * i) * Math.PI / 180);

        var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttributeNS(null, "cx", x);
        circle.setAttributeNS(null, "cy", y);
        circle.setAttributeNS(null, "r", main_tick_size);
        circle.setAttributeNS(null, "fill", main_tick_color);
        circle.setAttributeNS(null, "style", "stroke:none");
        gauge_area.appendChild(circle);
    }

    function createLabel(i) {
        var x = center_x + Math.sqrt(center_x / 2 * center_x / 2 + center_y / 2 * center_y / 2) * Math.cos((180 - tick_angle * i) * Math.PI / 180);
        var y = center_y - Math.sqrt(center_x / 2 * center_x / 2 + center_y / 2 * center_y / 2) * Math.sin((180 - tick_angle * i) * Math.PI / 180);

        var font_size = 22;
        if (i > 0 && i < main_tick_counter) {
            y = y + font_size / 2 + 1;
        }
        var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttributeNS(null, "x", x);
        text.setAttributeNS(null, "y", y);
        text.setAttributeNS(null, "fill", "#ffffff");
        text.setAttributeNS(null, "style", "font-size:" + font_size + "px; font-family:Arial");
        text.textContent = Math.round((parseFloat(r_min) + i * main_tick_step) * 100) / 100;
        gauge_area.appendChild(text);
        if (i > main_tick_counter / 2) {
            var translate_x = -text.getBBox().width - 1;
            text.setAttributeNS(null, "transform", "translate(" + translate_x + "," + 0 + ")");
        }
        if (i == main_tick_counter / 2) {
            var translate_x = -text.getBBox().width/2;
            var translate_y = text.getBBox().height /5;
            text.setAttributeNS(null, "transform", "translate(" + translate_x + "," + translate_y + ")");
        }
        labels[i] = text;
    }

    function changeLabels() {
        for (var i = 0; i < labels.length; i++) {
            labels[i].textContent = Math.round((r_min + i * main_tick_step) * 100) / 100;
        }
    }

    function drawColorRange(startValue, endValue, color) {
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        var x = center_x + Math.sqrt(center_x / 2 * center_x / 2 + center_y / 2 * center_y / 2) * Math.cos((180) * Math.PI / 180);
        var y = center_y - Math.sqrt(center_x / 2 * center_x / 2 + center_y / 2 * center_y / 2) * Math.sin((180) * Math.PI / 180);
        path.setAttributeNS(null, "style", "fill:none; stroke:" + color + "; stroke-width:8; stroke-opacity:0.8");
        path.setAttributeNS(null, "d", "M " + x + " " + y);
        gauge_area.appendChild(path);

        if (startValue < r_min) startValue = r_min;
        if (endValue > r_max) endValue = r_max;

        var startAngle = (startValue - r_min) * (180 / Math.abs(r_max - r_min));
        var endAngle = (endValue - r_min) * (180 / Math.abs(r_max - r_min));
        var i = 0;
        while (startAngle <= endAngle) {
            var radians = ((180 - startAngle) / 180) * Math.PI;
            var px = center_x + Math.cos(radians) * Math.sqrt(center_x / 4 * center_x / 4 + center_y / 4 * center_y / 4);
            var py = center_y - Math.sin(radians) * Math.sqrt(center_x / 4 * center_x / 4 + center_y / 4 * center_y / 4);
            //var px = center_x + Math.cos(radians) * Math.sqrt(center_x / 1.7 * center_x / 1.7 + center_y / 1.7 * center_y / 1.7);
            //var py = center_y - Math.sin(radians) * Math.sqrt(center_x / 1.7 * center_x / 1.7 + center_y / 1.7 * center_y / 1.7);
            //var px = center_x + Math.cos(radians) * Math.sqrt(center_x / 1.46 * center_x / 1.46 + center_y / 1.46 * center_y / 1.46);
            //var py = center_y - Math.sin(radians) * Math.sqrt(center_x / 1.46 * center_x / 1.46 + center_y / 1.46 * center_y / 1.46);
            var e = path.getAttribute("d");
            if (i == 0) {
                var d = e + " M " + px + " " + py;
            } else {
                var d = e + " L " + px + " " + py;
            }
            path.setAttributeNS(null, "d", d);
            startAngle += 0.5;
            i++;
        }
    }

    function transformDisplay() {
        if (textBox) {
            var fontSize = digitalValue.style.fontSize || digitalValue.parentNode.style.fontSize;
            if (digitalValue.parentNode.getBBox().width >= textBox.getBBox().width * 0.95) {
                digitalValue.style.fontSize = parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 0.90 + "px";
            }
            else if (digitalValue.parentNode.getBBox().width < textBox.getBBox().width * 0.80
                && parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 1.05 < fSize) {
                digitalValue.style.fontSize = parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 1.05 + "px";
            }

            digitalValue.parentNode.setAttributeNS(null, "transform", "translate("
                + parseInt(textBox.getBBox().x + (textBox.getBBox().width / 2
                    - digitalValue.parentNode.getBBox().width / 2)
                    - digitalValue.parentNode.getBBox().x)
                + "," + parseInt(textBox.getBBox().y +
                    (textBox.getBBox().height / 2 - digitalValue.parentNode.getBBox().height / 2)
                    - digitalValue.parentNode.getBBox().y) + ")");
        }
    }

    initComponent();
    that.disable(true);
    return that;
};

/**
 * SVG component represents Gauge.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT}
 * @returns {REX.UI.SVG.Gauge} New SVG Gauge component
 */
REX.UI.SVG.Gauge270 = function(svgElem,args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem,args);
    // Store options for simple usage
    var $o = that.options || {};
    
    // Load options or default values
    var r_min = that.checkNumber($o.rangeMin,0);         //minimum rozsahu
    var r_max = that.checkNumber($o.rangeMax,1);       //maximum rozsahu
    var tick_step = that.checkNumber($o.tickStep,5);               //krok maleho tiku
    var main_tick_step = that.checkNumber($o.mainTickStep,10);     //krok hlavniho tiku s oznacenim
    var decimals = that.checkNumber($o.decimals||$o.digitalPrecision,2); //pocet desetinnych mist pro zaokrouhleni digitalni hodnoty
    var o_units = $o.units || " ";                  //jednotky
    var colorZones = $o.colorZones || null; //barevne rozsahy
    var colorOffLimits = $o.colorOffLimits || "#ff7400";
    var fSize = 28;

    // Get SVG elements for manipulation
    var gauge_area = that.getChildByTag("gauge_area");   //cely objekt
    var hand = that.getChildByTag("hand");               //rucicka
    var hand1 = that.getChildByTag("hand1");             //1.cast rucicky
    var hand2 = that.getChildByTag("hand2");             //2.cast rucicky
    var middle_circle = that.getChildByTag("middle");    //kruhovy stred
    var border = that.getChildByTag("border");           //okraj
    var tick_0 = that.getChildByTag("tick_0");           //maly tik v pocatku
    var main_tick_0 = that.getChildByTag("main_tick_0"); //hlavni oznaceny tik v pocatku
    var digitalValue = that.getChildByTag("digitalval");   //digitalni hodnota
    var units = that.getChildByTag("units");             //jednotky
    var textBox = that.getChildByTag("text_box");        // prostor pro vykresleni hodnoty
    // Deprecated warning
    if(!textBox){that.log.warn(that.id +': Please upgrade this component');}

    //Global variables
    var center_x = null;     //x-ova souradnice stredu 
    var center_y = null;     //y-ova souradnice stredu 
    var tick_counter;               //pocet malych tiku
    var main_tick_counter;          //pocet hlavnich oznacenych tiku 
    var main_tick_size = 5;
    var main_tick_color = "#ffffff";
    var tick_angle;                 //uhel mezi jednotlivymi tiky
    var labels = [];       //pole hodnot pro popis osy
    var initComponentDone = false;

    // GetBBox methods is used here, init can be done when the getBBox is available    
    function initComponent() {
        if(initComponentDone){return;}
        if(!that.testBBox()){return;}

        center_x = gauge_area.getBBox().width / 2;     //x-ova souradnice stredu 
        center_y = gauge_area.getBBox().height / 2     //y-ova souradnice stredu 

        //Fill color, opacity, size
        tick_0.setAttributeNS(null, "style", "fill:#ffffff");
        main_tick_0.setAttributeNS(null, "style", "fill-opacity:0");
        tick_0.setAttributeNS(null, "height", tick_0.getBBox().height / 2);
        tick_0.setAttributeNS(null, "y", tick_0.getBBox().y + tick_0.getBBox().height * 2 / 2 - tick_0.getBBox().height / 2);
        hand.setAttributeNS(null, "style", "fill-opacity:1");

        //Set units
        units.textContent = ''+o_units;
        units.parentNode.setAttributeNS(null, "transform", "translate(" + parseInt((center_x - units.parentNode.getBBox().width / 2) - units.parentNode.getBBox().x) + "," + 0 + ")");

        //Draw ticks
        tick_counter = (Math.abs(r_max - r_min)) / tick_step;
        tick_angle = 270 / tick_counter;
        var i = 0;
        while (i <= tick_counter) {
            createTick(i, "#" + tick_0.id);
            i = i + 1;
        }
        //Draw main ticks
        main_tick_counter = (Math.abs(r_max - r_min)) / main_tick_step;
        tick_angle = 270 / main_tick_counter;
        i = 0;
        while (i <= main_tick_counter) {
            //createTick(i, "#main_tick_0");
            createMainTick(i);
            createLabel(i);
            i = i + 1;
        }

        //Draw color range
        for (var n = 0; n < colorZones.length; n++) {
            drawColorRange(parseFloat(colorZones[n].startValue), parseFloat(colorZones[n].endValue), colorZones[n].color);
        }

        // Change z-index on the top
        hand.parentNode.appendChild(hand);                   //posunuti rucicky v hierarchii uplne nahoru
        middle_circle.parentNode.appendChild(middle_circle); //posunuti kruhoveho stredu v hierarchii uplne nahoru
        
        initComponentDone = true;
    };

    // Add anonymous function as event listener. There are two events
    // 'read' - it is called every time when item is read
    // 'change' - called for the first time and every time item value is changed    
    that.$c.value.on('change', function(itm) {
        initComponent();
        if(!initComponentDone){return;}

        var value = itm.getValue();
        var angle = (value - r_min) * (270 / Math.abs(r_max - r_min));
        if (value >= r_min && value <= r_max) {
            hand1.setAttributeNS(null, "transform", "rotate(" + angle + "," + center_x + "," + center_y + ")");
            hand2.setAttributeNS(null, "transform", "rotate(" + angle + "," + center_x + "," + center_y + ")");
            digitalValue.style.fill = "#00ffff";
            border.setAttributeNS(null, "style", "fill:#000000");
        } else {
            if (value > r_max) {
                hand1.setAttributeNS(null, "transform", "rotate(" + 270 + "," + center_x + "," + center_y + ")");
                hand2.setAttributeNS(null, "transform", "rotate(" + 270 + "," + center_x + "," + center_y + ")");
                digitalValue.style.fill = colorOffLimits;
                border.style.fill = colorOffLimits;
                /*
                var tmp = r_min;
                r_min = r_min + 0.5 * Math.abs(r_max - tmp);
                r_max = r_max + 0.5 * Math.abs(r_max - tmp);
                changeLabels();
                */
            } else {
                hand1.setAttributeNS(null, "transform", "rotate(" + 0 + "," + center_x + "," + center_y + ")");
                hand2.setAttributeNS(null, "transform", "rotate(" + 0 + "," + center_x + "," + center_y + ")");
                digitalValue.style.fill = colorOffLimits;
                border.style.fill = colorOffLimits;
                /*
                var tmp = r_min;
                r_min = r_min - 0.5 * Math.abs(r_max - tmp);
                r_max = r_max - 0.5 * Math.abs(r_max - tmp);
                changeLabels();
                */
            }
        }
        digitalValue.innerHTML = value.toFixed(decimals);
        transformDisplay();
    });

    function createTick(i,tick_type) {
        var mat_a = Math.cos((tick_angle * i) * Math.PI / 180);
        var mat_b = Math.sin((tick_angle * i) * Math.PI / 180);
        var mat_e = (-center_x) * Math.cos((tick_angle * i) * Math.PI / 180) + center_y * Math.sin((tick_angle * i) * Math.PI / 180) + center_x;
        var mat_f = (-center_x) * Math.sin((tick_angle * i) * Math.PI / 180) - center_y * Math.cos((tick_angle * i) * Math.PI / 180) + center_y;

        var elem = document.createElementNS("http://www.w3.org/2000/svg", "use");
        elem.setAttributeNS("http://www.w3.org/1999/xlink", "href", tick_type);
        elem.setAttributeNS(null, "transform", "matrix(" + mat_a + "," + mat_b + "," + -mat_b + "," + mat_a + "," + mat_e + "," + mat_f + ")");
        gauge_area.appendChild(elem);
    }

    function createMainTick(i) {
        var x = center_x + Math.sqrt(center_x / 1.888 * center_x / 1.888 + center_y / 1.888 * center_y / 1.888) * Math.cos((225 - tick_angle * i) * Math.PI / 180);
        var y = center_y - Math.sqrt(center_x / 1.888 * center_x / 1.888 + center_y / 1.888 * center_y / 1.888) * Math.sin((225 - tick_angle * i) * Math.PI / 180);

        var circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttributeNS(null, "cx", x);
        circle.setAttributeNS(null, "cy", y);
        circle.setAttributeNS(null, "r", main_tick_size);
        circle.setAttributeNS(null, "fill", main_tick_color);
        circle.setAttributeNS(null, "style", "stroke:none");
        gauge_area.appendChild(circle);
    }

    function createLabel(i) {
        var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        var x = center_x + Math.sqrt(center_x/2 * center_x/2 + center_y/2 * center_y/2) * Math.cos((225 - tick_angle * i) * Math.PI / 180);
        var y = center_y - Math.sqrt(center_x/2 * center_x/2 + center_y/2 * center_y/2) * Math.sin((225 - tick_angle * i) * Math.PI / 180);
        var font_size = 28;
        if (i > 0 && i < main_tick_counter) {
            y = y + font_size/2;
        }
        if (i == main_tick_counter / 2) {
            x = x - font_size / 3;
            y = y + font_size / 4;
        }
        if (i > main_tick_counter / 2) {
            x = x - font_size*1.1;
        }
        text.setAttributeNS(null, "x", x);
        text.setAttributeNS(null, "y", y);
        text.setAttributeNS(null, "fill", "#ffffff");
        text.setAttributeNS(null, "style", "font-size:" + font_size + "px; font-family:Arial");
        text.textContent = Math.round((parseFloat(r_min) + i * main_tick_step) * 100) / 100;
        gauge_area.appendChild(text);
        labels[i] = text;

    }

    function changeLabels() {
        for (var i = 0; i < labels.length; i++) {
            labels[i].textContent = Math.round((parseFloat(r_min) + i * main_tick_step)*100)/ 100;
        }
    }

    function drawColorRange(startValue,endValue,color) {
        var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        var x = center_x + Math.sqrt(center_x / 2 * center_x / 2 + center_y / 2 * center_y / 2) * Math.cos((225) * Math.PI / 180);
        var y = center_y - Math.sqrt(center_x / 2 * center_x / 2 + center_y / 2 * center_y / 2) * Math.sin((225) * Math.PI / 180);
        path.setAttributeNS(null, "style", "fill:none; stroke:" + color + "; stroke-width:10; stroke-opacity:0.7");
        path.setAttributeNS(null, "d", "M " + x + " " + y);
        gauge_area.appendChild(path);

        if (startValue < r_min) startValue = r_min;
        if (endValue > r_max) endValue = r_max;

        var startAngle = (startValue - r_min) * (270 / Math.abs(r_max - r_min));
        var endAngle = (endValue - r_min) * (270 / Math.abs(r_max - r_min));
        var i = 0;
        while (startAngle <= endAngle) {
            var radians = ((225 -startAngle) / 180) * Math.PI;
            //var px = center_x + Math.cos(radians) * Math.sqrt(center_x / 3 * center_x / 3 + center_y / 3 * center_y / 3);
            //var py = center_y - Math.sin(radians) * Math.sqrt(center_x / 3 * center_x / 3 + center_y / 3 * center_y / 3);
            var px = center_x + Math.cos(radians) * Math.sqrt(center_x/1.558 * center_x/1.558 + center_y/1.558 * center_y/1.558);
            var py = center_y - Math.sin(radians) * Math.sqrt(center_x / 1.558 * center_x / 1.558 + center_y / 1.558 * center_y / 1.558);
            //var px = center_x + Math.cos(radians) * Math.sqrt(center_x / 1.46 * center_x / 1.46 + center_y / 1.46 * center_y / 1.46);
            //var py = center_y - Math.sin(radians) * Math.sqrt(center_x / 1.46 * center_x / 1.46 + center_y / 1.46 * center_y / 1.46);
            var e = path.getAttribute("d");
            if (i == 0) {
                var d = e + " M " + px + " " + py;
            } else {
                var d = e + " L " + px + " " + py;
            }
            path.setAttributeNS(null, "d", d);
            startAngle += 0.5;
            i++;
        }
    }

    function transformDisplay() {
        if (textBox) {
            var fontSize = digitalValue.style.fontSize || digitalValue.parentNode.style.fontSize;
            if (digitalValue.parentNode.getBBox().width >= textBox.getBBox().width * 0.95) {
                digitalValue.style.fontSize = parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 0.90 + "px";
            }
            else if (digitalValue.parentNode.getBBox().width < textBox.getBBox().width * 0.80
                && parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 1.05 < fSize) {
                digitalValue.style.fontSize = parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 1.05 + "px";
            }

            digitalValue.parentNode.setAttributeNS(null, "transform", "translate("
                + parseInt(textBox.getBBox().x + (textBox.getBBox().width / 2
                    - digitalValue.parentNode.getBBox().width / 2)
                    - digitalValue.parentNode.getBBox().x)
                + "," + parseInt(textBox.getBBox().y +
                    (textBox.getBBox().height / 2 - digitalValue.parentNode.getBBox().height / 2)
                    - digitalValue.parentNode.getBBox().y) + ")");
        }
    }
    
    initComponent();
    that.disable(true);
    return that;
};


REX.UI.SVG.GaugeBars = function(svgElem,args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem,args);
    // Store options for simple usage
    var $o = that.options || {};
    
    // Load options or default values
    var r_min = that.checkNumber($o.rangeMin, 0); //minimum rozsahu
    var r_max = that.checkNumber($o.rangeMax, 100); //maximum rozsahu
    var decimals = that.checkNumber($o.decimals, 0); //pocet desetinnych mist pro zaokrouhleni digitalni hodnoty
    var o_units = $o.units || "%";                  //jednotky    
    var o_label = $o.label || "power";              //obsah popisku
    
    // Get SVG elements for manipulation
    var text = that.getChildByTag("text");             //hodnota textove
    var label = that.getChildByTag("label");           //popisek  
    
    var ticks = $(that.element).find('[rexsvg\\:tag="tick"]');
    var ticksCount = ticks.length;
    // var range = r_max-r_min;
    //Set units
    label.textContent = ''+o_label;    

    that.$c.value.on('change', function(itm) {
        
        var value = itm.getValue();            
        var actTickCount = Math.round((value - r_min) * (ticksCount / Math.abs(r_max - r_min)));
        ticks.slice(0,actTickCount).hide();
        ticks.slice(actTickCount).show();
        text.textContent = value.toFixed(decimals) + ' ' + o_units;
    });

    

    return that;
};


REX.UI.SVG.GaugeGradient = function(svgElem,args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem,args);
    // Store options for simple usage
    var $o = that.options || {};
    var r_min = that.checkNumber($o.rangeMin, 0); //minimum rozsahu
    var r_max = that.checkNumber($o.rangeMax, 1); //maximum rozsahu
    
    // Load options or default values        
    
    var overlay = $(that.getChildByTag("overlay"));
    
     
    function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        var angleInRadians = (angleInDegrees) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    }

    function describeArc(x, y, radius, startAngle, endAngle){
        
        var start = polarToCartesian(x, y, radius, endAngle);
        var end = polarToCartesian(x, y, radius, startAngle);        

        var arcSweep = endAngle - startAngle <= 180 ? "0" : "1";        
        
        var d = [
            "M", start.x, start.y,
            "A", radius, radius, 0, arcSweep, 0, end.x, end.y,            
            //"L", x,y,
            //"L", start.x, start.y            
        ].join(" ");
        return d;
    }

    /**
     * Return necessary information about Path (arc) object
     * @param svgPath - SVG Path
     * @param max {Number} - maximum when the circle is full
     * @returns {{element: svhPath, cx: Number, cy: Number, rx: Number, ry: Number, max: *, current: *}}
     */
    function initArc(svgPath,start) {
        return {
            element:svgPath,
            cx: parseFloat(svgPath.attr('sodipodi:cx')),
            cy: parseFloat(svgPath.attr('sodipodi:cy')),
            rx: parseFloat(svgPath.attr('sodipodi:rx')),
            ry: parseFloat(svgPath.attr('sodipodi:ry')),
            start: start,
            current: 0,
            update: function(current,cw){
                this.current = current;
                var arc;
                if(!cw){
                    arc = describeArc(this.cx,this.cy,this.rx,start,current);
                }
                else{
                    arc = describeArc(this.cx,this.cy,this.rx,current,start);
                }
                svgPath.attr('d',arc);
            }
        }
    }
    var greenArc = initArc($(that.getChildByTag("greenBar")),135);
    var redArc = initArc($(that.getChildByTag("redBar")),405);    
    
    var init = true;    
    that.$c.value.on('change', function(itm) {        
        if(init){overlay.hide();init=false;}                        
        var value = (itm.getValue() - r_min)/ Math.abs(r_max - r_min);        
        // Saturation
        if(value>1){value = 1;}
        if(value<0){value = 0;}
        
        greenArc.update(135+(270*value));
        redArc.update(405-(270*(1-value)),true);
    });

    

    return that;
};

/**
 * SVG component represents General Component with multiple transformation
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT} 
 * @returns {REX.UI.SVG.GeneralComponent} New Genral Component component
 */
REX.UI.SVG.GeneralComponent = function(svgElem, args) {
    var that = new REX.UI.SVG.Component(svgElem, args);
    var $o = that.options || {};

    $o.changeFill = that.check($o.changeFill, "True");

    var bbox,
        elemCenterX,
        elemCenterY,
        ocmi = $o.colorMin || ' ',
        ocma = $o.colorMax || ' ',
        R_min = hexToR(ocmi) || 0,
        G_min = hexToG(ocmi) || 0,
        B_min = hexToB(ocmi) || 0,
        R_max = hexToR(ocma) || 0,
        G_max = hexToG(ocma) || 0,
        B_max = hexToB(ocma) || 0,
        changeFill = that.parseBoolean($o.changeFill),
        changeStroke = that.parseBoolean($o.changeStroke),
        rotationR = that.checkNumber($o.rotationRange, 0),
        rotationSMax = that.checkNumber($o.rotationSignalMax, 0),
        rotationSMin = that.checkNumber($o.rotationSignalMin, 0),
        rotOffsetX = that.checkNumber(
            that.element.getAttribute('inkscape:transform-center-x'), 0),
        rotOffsetY = that.checkNumber(
            that.element.getAttribute('inkscape:transform-center-y'), 0),
        scaleMax = that.checkNumber($o.scaleMax, 0),
        scaleMin = that.checkNumber($o.scaleMin, 0),
        scaleSMax = that.checkNumber($o.scaleSignalMax, 0),
        scaleSMin = that.checkNumber($o.scaleSignalMin, 0),
        scaleX = that.parseBoolean($o.scaleX),
        scaleY = that.parseBoolean($o.scaleY),
        opacityMax = that.checkNumber($o.opacityMax, 0),
        opacityMin = that.checkNumber($o.opacityMin, 0),
        opacityR = opacityMax - opacityMin || 0,
        opacitySMax = that.checkNumber($o.opacitySignalMax, 0),
        opacitySMin = that.checkNumber($o.opacitySignalMin, 0),
        txR = that.checkNumber($o.xRange, 0),
        txSMax = that.checkNumber($o.xSignalMax, 0),
        txSMin = that.checkNumber($o.xSignalMin, 0),
        tyR = that.checkNumber($o.yRange, 0),
        tySMax = that.checkNumber($o.ySignalMax, 0),
        tySMin = that.checkNumber($o.ySignalMin, 0),
        type = that.check($o.type, 'PushButton'),
        onMouseDownValue = that.parseBoolean($o.reverseMeaning) ? 0 : 1,        
        // List of all child nodes with updatePosition function
        children = null,
        childrenTRND = [],
        childrenHTML = [];
    
    
    that.element.setAttribute('transform', '');
    var tRotate,tTranslate,tScale,tScaleT;
    // K animaci se nove vyuziva nastaveni atributu primo objektu transformace. Diky tomu lze lehce nastavit vsechny typy
    // tranfsormaci nad stejnym objektem. Dulezite je tady jejich retezeni viz kod nize
    if(that.element.transform){
        that.element.transform.baseVal.clear();
        tTranslate = that.svg.createSVGTransform();
        tTranslate.setTranslate(0,0);        
        tScale = that.svg.createSVGTransform();
        tScale.setScale(1,1);    
        tScaleT = that.svg.createSVGTransform();
        tScaleT.setTranslate(0,0);
        tRotate = that.svg.createSVGTransform();
        tRotate.setRotate(0,0,0);        
        // Toto je potreba zachovat aby se objekt spravne animoval dle nastaveneho stredu pomoci atributu transform-center
        that.element.transform.baseVal.appendItem(tTranslate);
        that.element.transform.baseVal.appendItem(tScaleT);
        that.element.transform.baseVal.appendItem(tScale);        
        that.element.transform.baseVal.appendItem(tRotate);
    }

    // Firefox is not able to calculate bounding box size 
    // when the element is hidden by display:none, thus 
    // need to refresh the bbox if not defined
    function refreshBBox(){
        if(!bbox || bbox.width == 0 || bbox.height == 0){
            try{
                bbox = that.element.getBBox();
                elemCenterX = bbox.x + bbox.width / 2;
                elemCenterY = bbox.y + bbox.height / 2;
            }
            catch(error){
                bbox = null;
            }
        }
    }

    

    that.changeColor = function(color) {
        if (typeof color === 'boolean'){
            if(color){
                color = 1
            }
            else{
                color = 0
            }
        }
        if (REX.HELPERS.isNumber(color)) {
            var R, G, B, X;

            if (color > $o.colorSignalMin && color < $o.colorSignalMax) {
                R = Math.round(R_min + ((R_max - R_min) * (color - $o.colorSignalMin)) / ($o.colorSignalMax - $o.colorSignalMin));
                G = Math.round(G_min + ((G_max - G_min) * (color - $o.colorSignalMin)) / ($o.colorSignalMax - $o.colorSignalMin));
                B = Math.round(B_min + ((B_max - B_min) * (color - $o.colorSignalMin)) / ($o.colorSignalMax - $o.colorSignalMin));
                X = rgbToHex(R, G, B);
                if(changeFill){
                    that.element.style.fill = X;
                }
                if(changeStroke){
                    that.element.style.stroke = X;
                }
            }
            else if (color <= $o.colorSignalMin) {
                if(changeFill){
                    that.element.style.fill = $o.colorMin;
                }
                if(changeStroke){
                    that.element.style.stroke = $o.colorMin;
                }
            }
            else if (color >= $o.colorSignalMax) {
                if(changeFill){
                    that.element.style.fill = $o.colorMax;
                }
                if(changeStroke){
                    that.element.style.stroke = $o.colorMax;
                }
            }
            else {
                if(changeFill){
                    that.element.style.fill = "grey";
                }
                if(changeStroke){
                    that.element.style.stroke = "grey";
                }
            }
            return;
        } else if (typeof color === 'string') {
            if(changeFill){
                that.element.style.fill = color;
            }
            if(changeStroke){
                that.element.style.stroke = color;
            }
        }
    };

    //Known bug: FS#2766 - v prohlizeci Firefox a Chrome se rozdilne pocita bounding box. Firefox to dela jako Inkscape
    // Chrome ne. Tudiz pokud se nachazi v potomcich grupy General Component nejaky prvek s attributem transform
    // muze to delat potize. Viz FS#2766.
    that.rotate = function (angle) {
        refreshBBox();
        var angleR = rotationR * (angle - rotationSMin) / (rotationSMax - rotationSMin);
        if (tRotate) {
            tRotate.setRotate(angleR,(elemCenterX + rotOffsetX),(elemCenterY - rotOffsetY));
        }
        else { //Deprecated            
            var str = that.element.getAttribute('transform');
            var oldVal = getOldValue('rotate', str);
            var newVal = 'rotate(' + angleR + ',' + (elemCenterX + rotOffsetX) + ',' + (elemCenterY - rotOffsetY) + ')';
            str = str.replace(oldVal, newVal);
            that.element.setAttribute('transform', str);
        }
    };

    that.translate = function (val, axis) {
        if (tTranslate) {
            let tXa,tYa;
            if (axis === 'x') {
                tXa = txR * (val - txSMin) / (txSMax - txSMin);
                tYa = tTranslate.matrix.f;
            }
            else{
                tXa = tTranslate.matrix.e;
                tYa = tYa = tyR * (val - tySMin) / (tySMax - tySMin);
            }
            tTranslate.setTranslate(tXa,tYa);
        }
        else { // Deprecated
            var str, startI, endI, toReplace, newVal, oldVal;
            if (axis === 'x') {
                var tXa = txR * (val - txSMin) / (txSMax - txSMin),
                    str = that.element.getAttribute('transform'),
                    oldVal = getOldValue('translate', str);
                if (oldVal === '') {
                    newVal = 'translate(' + tXa + ',0)';
                }
                else {
                    startI = oldVal.search('\\(');
                    endI = oldVal.search(',');
                    toReplace = oldVal.slice(startI + 1, endI + 1);
                    newVal = oldVal.replace(toReplace, tXa + ',');
                }
            }
            else {
                var tYa = tyR * (val - tySMin) / (tySMax - tySMin),
                    str = that.element.getAttribute('transform'),
                    oldVal = getOldValue('translate', str);
                if (oldVal === '') {
                    newVal = 'translate(0,' + (-tYa) + ')';
                }
                else {
                    startI = oldVal.search(',');
                    endI = oldVal.search('\\\)');
                    toReplace = oldVal.slice(startI, endI);
                    newVal = oldVal.replace(toReplace, ',' + tYa);
                }
            }

            str = str.replace(oldVal, newVal);
            that.element.setAttribute('transform', str);
        }
    };

    that.scale = function(scale) {
        refreshBBox();
        if(tScale){
            let scaleA = scaleMin + (scaleMax - scaleMin) * (scale - scaleSMin) / (scaleSMax - scaleSMin);
            let sx = scaleX?scaleA:1;
            let sy = scaleY?scaleA:1;
            tScaleT.setTranslate(((1 - sx) * (elemCenterX + rotOffsetX)),((1 - sy) * (elemCenterY - rotOffsetY)));
            tScale.setScale(sx,sy);
        }
        else{ // Deprecated
            if (scaleX || scaleY) {
                var oldVal, newVal;
                var scaleA = parseFloat(scaleMin) + (scaleMax - scaleMin) * (scale - scaleSMin) / (scaleSMax - scaleSMin),
                        str = that.element.getAttribute('transform');
                oldVal = getOldValue('matrix', str);
                if (scaleX && !scaleY) {
                    newVal = 'matrix(' + scaleA + ',0,0,1,' + ((1 - scaleA) * (elemCenterX + rotOffsetX)) + ',0)';
                }
                if (!scaleX && scaleY) {
                    newVal = 'matrix(1,0,0,' + scaleA + ',0,' + ((1 - scaleA) * (elemCenterY - rotOffsetY)) + ')';
                }
                if (scaleX && scaleY) {
                    newVal = 'matrix(' + scaleA + ',0,0,' + scaleA + ',' + ((1 - scaleA) * (elemCenterX + rotOffsetX)) + ',' + ((1 - scaleA) * (elemCenterY - rotOffsetY)) + ')';
                }
                str = str.replace(oldVal, newVal);
                that.element.setAttribute('transform', str);
            }
        }
        
    };

    that.opacity = function(opacity) {
        var opacityA = opacityMin + opacityR * (opacity - opacitySMin) / (opacitySMax - opacitySMin);
        that.element.setAttribute('opacity', Math.abs(opacityA));
        if (opacityA <= 0) {
            $(that.element).css('pointer-events', 'none');             
            refreshTRND(false); // Pause
        }
        else{
            $(that.element).css('pointer-events', 'auto');
            refreshTRND(true); // Resume
        }
    };

    function findChildren() {
        if (that.manager && children == null) {
            let childElems = svgElem.querySelectorAll('[rexsvg\\:module]');
            children = [];
            for (let child of childElems) {
                let cmp = that.manager.getComponentById(child.getAttribute('id'));
                if(cmp){ // For example Wrapper is not included in components list
                    children.push(cmp);
                    if (cmp.updatePosition) {
                        childrenHTML.push(cmp);
                    }
                    if (cmp.graph) {
                        childrenTRND.push(cmp);
                    }
                }
            }
        }
    }

    function refreshTRND(resume) {
        findChildren();
        for (let child of childrenTRND) {
            if (resume) {
                child.show();
                if (child.graph.initDone) {
                    child.graph.resume();
                }
            }
            else {
                child.hide();
                if (child.graph.initDone) {
                    child.graph.pause();
                }
            }
        }
    }
    
    function refreshChildrenPosition() {
        findChildren();
        for (let child of childrenHTML) {
            child.updatePosition();
        }
    }

    if (typeof that.$c.COLOR !== "undefined") {                
        removeColorAttrFromChildren();
        if(changeFill){
            that.element.style.fill = "grey";
        }
        if(changeStroke){
            that.element.style.stroke = "grey";
        }        
        that.$c.COLOR.on('change', function(i) {
            that.changeColor(i.getValue());
            that.emit('color');
        });
    }
    if (typeof that.$c.ROTATE !== "undefined") {
        that.$c.ROTATE.on('change', function(i) {
            that.rotate(i.getValue());
            that.emit('rotate');
            refreshChildrenPosition();
        });
    }
    if (typeof that.$c.TRANSLATE_X !== "undefined") {
        that.$c.TRANSLATE_X.on('change', function(i) {
            that.translate(i.getValue(), 'x');
            that.emit('translate-x');
            refreshChildrenPosition();
        });
    }
    if (typeof that.$c.TRANSLATE_Y !== "undefined") {
        that.$c.TRANSLATE_Y.on('change', function(i) {
            that.translate(i.getValue(), 'y');
            that.emit('translate-y');
            refreshChildrenPosition();
        });
    }
    if (typeof that.$c.SCALE !== "undefined") {
        that.$c.SCALE.on('change', function(i) {
            that.scale(i.getValue());
            that.emit('scale');
            refreshChildrenPosition();
        });
    }
    if (typeof that.$c.OPACITY !== "undefined") {
        that.$c.OPACITY.on('change', function(i) {
            that.opacity(i.getValue());
            that.emit('opacity');
        });
    }

    // If this component should behave as a button
    if (that.$c.value) {
        // Stavove promenne
        var pressed = false;
        var active = false;
        var hover = false;

        let $element = $(that.element);
        
        $element.css('cursor', 'pointer');
        $element.on({
            mouseenter: function () {
                hover = true;
                that.refresh();
            },
            mouseleave: function () {
                hover = false;
                that.refresh();
            }
        });
        
        let dropshadowID = "";
        let pressedshadowID ="";

        // FS#3332 - Upraveno kvuli DWM. Nelze pouzivat fixni URL na filtry a podobne, protoze kazda dalsi importovana stranka 
        // odkazuje na prvni dokument a tim se tam zanasi neporadek. Ted se pro dane SVG vytvori filtr pro stin pri hover a press.
        // Na ten se odkazuje pomoci javascriptu protoze to nelze zmenit v CSS tride
        if ($(that.defs).find('.gc-filter--dropshadow').length == 0) {
            let suffix = Math.round(Math.random() * 1E9).toString(32).toUpperCase();
            dropshadowID = `dropshadow-${suffix}`;
            pressedshadowID = `pressedshadow-${suffix}`;

            let shadow =
                `<filter id="${dropshadowID}" class="gc-filter--dropshadow" height="130%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="4"/> <!-- stdDeviation is how much to blur -->
                <feOffset dx="2" dy="2" result="offsetblur"/> <!-- how much to offset -->
                <feComponentTransfer>
                    <feFuncA type="linear" slope="0.5"/> <!-- slope is the opacity of the shadow -->
                </feComponentTransfer>
                <feMerge> 
                    <feMergeNode/> <!-- this contains the offset blurred image -->
                    <feMergeNode in="SourceGraphic"/> <!-- this contains the element that the filter is applied to -->
                </feMerge>
            </filter>`;
            that.defs.insertAdjacentHTML('beforeend', shadow);

            let pressedShadow =
                `<filter id="${pressedshadowID}" class="gc-filter--pressedshadow">
                <feColorMatrix
                type="matrix"
                values="0   0   0   0   0
                        0   0   0   0   0
                        0   0   0   0   0
                        0   0   0   0.25 0 "/>
                <feMerge> 
                    <feMergeNode in="SourceGraphic"/> <!-- this contains the element that the filter is applied to -->    
                    <feMergeNode/> <!-- this contains the offset blurred image -->                
                </feMerge>
            </filter>`;
            that.defs.insertAdjacentHTML('beforeend', pressedShadow);
        }
        else{
            dropshadowID = $(that.defs).find('.gc-filter--dropshadow').attr('id');
            pressedshadowID =$(that.defs).find('.gc-filter--pressedshadow').attr('id');
        }

        // Add `write` and `refresh` functions. Necessary for all write components 
        // with *value* and  *refresh_from* items.
        that.addWriteInterface();
        var oldDisable = that.disable;
        that.disable = function () {
            oldDisable.apply(that,arguments);
            $element.css('cursor', 'default');
            $element.css('pointer-events', 'none');
            pressed = false;
            that.refresh();
        };

        var oldEnable = that.enable;    
        that.enable = function () {
            // Enable only if enable is allowed
            if(oldEnable.apply(that, arguments)){                
                $element.css('cursor', 'pointer');
                $element.css('pointer-events', '');
                that.refresh();
            }        
        };

        var oldHide = that.hide;
        that.hide = function () {
            oldHide.apply(that,arguments);
            pressed = false;
        };

        if (type === 'ToggleButton' && that.$c.value !== that.$c.refresh_from) {
            that.log.error(`Refresh_from datapoint is not supported in the Toggle mode!`);
            that.refresh();
            that.disable();
            // Vypne funkci enable a ukonci ostatni inicializace
            that.enable=function(){};
            return that;
        }

        that.refresh = function(){
            let value = that.$c.refresh_from.getValue();
            if (value === (1 - onMouseDownValue) || value === null) {                
                active = false;
            }
            else {                                
                active = true;
            }

            if (hover) {
                if (active) {
                    that.element.style.filter = `url("#${pressedshadowID}") url("#${dropshadowID}")`;
                }
                else {
                    that.element.style.filter = `url("#${dropshadowID}")`;
                }
            }
            else {
                if (active) {
                    that.element.style.filter = `url("#${dropshadowID}")`;
                }
                else {
                    that.element.style.filter = 'none';
                }
            }
        };
    
        let loopWrite = function () {
            that.$c.value.write(onMouseDownValue)
                .then(() => {
                    setTimeout(() => {
                        if (pressed) {
                            loopWrite();
                        }
                    }, 20);
                })
                .catch(that.writeFailed);
        };
    
        $(that.element).bind('touchstart mousedown', function(evt) {
            evt.preventDefault(); 
            this.focus();
            if (evt.handled !== true) {
                // Primary mouse button only            
                if (!(evt.button && evt.button > 0)) {                
                    if (type === 'ToggleButton') {
                        if (!active) {
                            that.write(onMouseDownValue);
                            active = true;                            
                        }
                        else {
                            that.write(1 - onMouseDownValue);
                            active = false;
                        }
                    }
                    else if (type === 'ManualPulseRpt') {
                        loopWrite();
                    }
                    else {
                        that.write(onMouseDownValue);
                    }
                    pressed = true;
                    that.emit('mousedown');                
                }
                evt.handled = true;
            } else {
                return false;
            }
        })
        .bind('touchend touchcancel touchleave mouseup mouseleave', function(evt) {
            evt.preventDefault();
            this.blur();
            if (evt.handled !== true) {
                // Primary mouse button only       
                // Invoke only when the button was pressed before
                if (!(evt.button && evt.button > 0) && pressed) {                    
                    if (type === 'PushButton') {
                        that.write(1 - onMouseDownValue);
                    }
                    that.emit('mouseup');
                    pressed = false;
                }
                evt.handled = true;
            } else {
                return false;
            }
        });
    
        that.setReadOnly = function () {
            that.readOnly = true;
            pressed = false;
            $element.off().removeData();
            $element.css('pointer-events', 'none');
            $element.css('filter', '');
        };    
        that.refresh();    
    }

    // Coponents is detached dialog
    if(that.element.getAttribute('rexsvg:dialog')){
        let parentDiv = that.element.closest('div');
        let oldHide = that.hide;
        // [FS#3718] Jelikoz v DWM se nekdy provede change event predtim nez se nacte dialog
        // tak volam zobrazeni dialogu s udalosti read. Dale jsem doplni, ze se dialog zobrazi pouze 
        // pokud nebyl zobrazeny
        
        // Deafultne je dialog schovany
        that.hide();
        parentDiv.style.display = 'none';

        // Hide a show se vola pokud se neco zmenilo
        that.hide = function(){
            if (parentDiv.style.display != 'none'){
                oldHide.apply(this);
                parentDiv.style.display = 'none';
            }
        };

        let oldShow = that.show;
        that.show = function(){
            if (parentDiv.style.display != ''){
                oldShow.apply(this);
                parentDiv.style.display = '';
            }
        };
        
        // Pridana reakce na cteni promenne v kazdem kroku 
        if (that.items.hide_by) {
            that.items.hide_by.on('read',(itm)=>{
                if(itm.getValue()){
                    that.hide();
                }
                else{
                    that.show();
                }
            });
        }
    }

    // Deprecated
    function getOldValue(option, string) {
        var startVal = string.search(option + '\\(');
        if (startVal > -1) {
            string = string.slice(startVal);
            var endVal = string.search('\\\)');
            return string.slice(0, endVal + 1);
        }
        else
            return '';
    }

    function removeColorAttrFromChildren() {
        var childNodes = Array.prototype.slice.call(that.element.childNodes);

        for (var i = 0; i < childNodes.length; i++) {
            var item = childNodes[i];
            if (item.getAttribute) {
                if(changeFill){
                    item.style.fill = '';
                }
                if(changeStroke){
                    item.style.stroke = '';
                }                
            }
            childNodes = childNodes.concat(Array.prototype.slice.call(item.childNodes));
        }
    }
    function rgbToHex(R, G, B) {
        return '#' + toHex(R) + toHex(G) + toHex(B);
    }
    function toHex(n) {
        n = parseInt(n, 10);
        if (isNaN(n))
            return "00";
        n = Math.max(0, Math.min(n, 255));
        return "0123456789ABCDEF".charAt((n - n % 16) / 16) + "0123456789ABCDEF".charAt(n % 16);
    }
    
    function hexToR(h) {
        return parseInt((cutHex(h)).substring(0, 2), 16);
    }
    
    function hexToG(h) {
        return parseInt((cutHex(h)).substring(2, 4), 16);
    }
    
    function hexToB(h) {
        return parseInt((cutHex(h)).substring(4, 6), 16);
    }
    
    function cutHex(h) {
        return (h.charAt(0) === "#") ? h.substring(1, 7) : h;
    }

    // Refresh component to be shown in Firefox
    that.hide();
    setTimeout(()=>{that.show();},100);
    that.disable(true);
    return that;
};
REX.UI.SVG.ImageChanger = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem, args);
    var $o = that.options || {};
    var appendKey = that.parseBoolean($o.appendKey);
    that.imagePath = that.check($o.imagePath, './image.png');
    that.period = that.checkNumber($o.period, '-1');


    var timer = null;
    var imageIsLoading = false;

    var svgImage = SVG.adopt(that.getChildByTag("image")); //image

    svgImage.attr('preserveAspectRatio',that.check($o.preserveAspectRatio,'none'));
    // Pokud nacitame velky obrazek je potreba pri periodickem cteni pockat nez se nacte.
    // V pripade ze cekat nechceme tak se zavolanim metody `refresh` udela nacetni natvrdo
    svgImage.on('load', () => {
        imageIsLoading = false;
    });

    if (that.$c.refresh_from) {
        that.$c.refresh_from.on('change', refresh);
    }

    function startTimer() {
        if (that.period >= 0) {
            if (timer) {
                clearInterval(timer);
            }
            timer = setInterval(() => {
                if (!imageIsLoading) {
                    refresh();
                }
            }, that.period);
        }
    }

    function stopTimer() {
        if (timer) {
            clearInterval(timer);
        }
    }

    function refresh() {
        var itm = that.$c.refresh_from;
        if (that.isDisabled()) {
            return;
        }
        var path = that.imagePath;
        if (itm && appendKey) {
            path = path.replace('{0}', itm.getValue());
        }
        path += '?version=' + new Date().getTime().toString(32); // Add some hash to refresh image
        imageIsLoading = true;
        svgImage.attr('xlink:href', path);
    }

    var oldHide = that.hide;
    that.hide = function () {
        oldHide.apply(that, arguments);
        stopTimer();
    };

    var oldShow = that.show;
    that.show = function () {
        oldShow.apply(that, arguments);
        refresh();
        startTimer();
    };

    var oldDisable = that.disable;
    that.disable = function () {
        oldDisable.apply(that, arguments);
        stopTimer();
    };

    var oldEnable = that.enable;
    that.enable = function () {
        if (oldEnable.apply(that, arguments)) {
            refresh();
            startTimer();
        }
    };

    return that;
};
/**
 * SVG component represents numeric input.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT} 
 * @returns {REX.UI.SVG.Input} New SVG numeric input component
 */
REX.UI.SVG.Input = function (svgElem, args) {
    // Inherit from base component
    let that = new REX.UI.SVG.HTMLComponent(svgElem, args);
    let $o = that.options || {};
    let $div = $(that.div);
    let utils = that.utils;

    let format = ($o.format || '').toLowerCase();
    let fontScale = that.checkNumber($o.fontScale, 1);
    let align = utils.check($o.textAlign, 'left');
    let min = utils.checkNumber($o.min, -Number.MAX_VALUE);
    let max = utils.checkNumber($o.max, Number.MAX_VALUE);
    let scale = utils.checkNumber($o.scale, 1);
    let offset = utils.checkNumber($o.offset, 0);
    let decimals = utils.checkNumber($o.decimals, 2);
    let digits = utils.checkNumber($o.digits, -1);
    let setOnBlur = utils.parseBoolean($o.setOnBlur,false); 

    let readOnly = false;
    let inputTime = null;
    let timeFormat = null;

    // Add `write` and `refresh` functions. Necessary for all write components 
    // with *value* and  *refresh_from* items.
    that.addWriteInterface();

    let input = $(document.createElement('input'));        
    input.addClass('rex__module-input rex__input rex__input--default rex__fill');
    $div.append(input);
    $(input).css({'text-align':align});

    if ($o.css) {
        if (typeof $o.css === 'object') {
            $(input).css($o.css);
        }
        else {
            that.log.error(that.id + "css property is not an object. Write it as a value pair JSON object");
        }
    }

    // Init font autoresize
    function updateFontSize() {
        let ctm = that.svg.getScreenCTM();
        // Scale according the width or height which is better
        if (ctm) {
            let size = Math.min(ctm.a, ctm.d) * fontScale + 'em';
            input.css('font-size', size);
            if(inputTime){
                inputTime.css('font-size', size);
            }
        }
    }

    function pressEnterKey() {
        let e = $.Event("keypress");
        e.which = 13; //Enter key
        e.keyCode = 13;
        input.trigger(e);
    }

    let keyboardOptions = {
        accepted: pressEnterKey
    };

    if(format === 'password'){
        input.attr('type', 'password');
    }
    if(!readOnly){
        switch (format) {
            case 'date':
                input.attr('type', 'date');
                input.on('change', pressEnterKey);
                utils.initKeyboard(input,keyboardOptions);
                break;
            case 'time-seconds':                
            case 'time':
                input.attr('type', 'time');
                input.on('change', pressEnterKey);
                if(format.indexOf('-seconds')>0){
                    input.attr('step', 1);
                }
                utils.initKeyboard(input,keyboardOptions);            
                break;
            case 'datetime-seconds':
            case 'datetime':
                input.attr('type', 'date');
                input.removeClass('rex__fill');
                utils.initKeyboard(input,keyboardOptions);            
    
                inputTime = $(document.createElement('input'));
                inputTime.addClass('rex__module-input rex__input rex__input--default');                
                inputTime.attr('type', 'time');
                if(format.indexOf('-seconds')>0){
                    inputTime.attr('step', 1);
                }
                utils.initKeyboard(inputTime,keyboardOptions);
                $div.append(inputTime);
                $div.addClass('rex__div--datetime');    

                input.on('change', pressEnterKey);
                inputTime.on('change', pressEnterKey);

                inputTime.focus(onFocus).blur(onBlur);
                inputTime.keypress(function (evt) {
                    let keyCode = evt.keyCode || evt.which;
                    if (keyCode === 13) { //Enter keycode
                        let e = $.Event("keypress");
                        e.which = 13; //choose the one you want
                        e.keyCode = 13;
                        input.trigger(e);
                    }
                });
                inputTime.keyup(function (evt) {
                    let keyCode = evt.keyCode || evt.which;
                    if (keyCode === 27) { //ESC keycode
                        let setOnBlurTmp = setOnBlur;
                        // Temporary disable set on blur behaviour for ESC key
                        setOnBlur = false;
                        inputTime.blur();
                        setOnBlur = setOnBlurTmp;
                    }
                });
                break;
            case 'password':
            case 'text':
                utils.initKeyboard(input,keyboardOptions);
                break;
            default:
                utils.initKeyboard(input,keyboardOptions,'number');
                break;
        }
    }

    // Adjust virtual keyboard if defines - stop updating font size for preview
    let onKbVisible = function onKbVisible(event, keyboard, el) {
        if(keyboard.options.usePreview){
            keyboard.$preview.css('font-size', '');
        }            
    };

    let kb = input.data('keyboard');
    if (kb) {        
        input.bind('visible', onKbVisible);        
    }    
    if (inputTime) {
        kb = inputTime.data('keyboard');
        if (kb) {        
            inputTime.bind('visible', onKbVisible);        
        }    
    }

    input.focus(onFocus).blur(onBlur);    

    input.keypress(function (evt) {
        let keyCode = evt.keyCode || evt.which;
        if (keyCode === 13) { //Enter keycode
            let value = input.val();
            switch (format) {
                case 'password':
                case 'text':
                    that.write(value);
                    break;
                case 'date':
                    if (!value) {
                        return;
                    }
                    let rexSeconds = utils.getREXSecondsFromDate(new Date(value));                    
                    that.write(rexSeconds);
                    break;
                case 'time-seconds':
                case 'time':
                    if (!value) {
                        return;
                    }
                    let tmpDate = new Date('2000-01-01 ' + value);
                    let time = tmpDate.getSeconds() + (60 * (tmpDate.getMinutes() + (60 * tmpDate.getHours())));                    
                    that.write(time);                    
                    break;
                case 'datetime-seconds':
                case 'datetime':
                    if (!value || !inputTime.val()) {
                        return;
                    }
                    let datetime = utils.getREXSecondsFromDate(new Date(value + ' ' + inputTime.val()));                    
                    that.write(datetime);
                    break;
                default:
                    let numberStr = value.replace(',', '.');
                    if (utils.isNumber(numberStr)) {
                        let number = Number(numberStr);
                        if (number >= min && number <= max) {
                            input.removeClass('rex__input--error');
                            if (!that.isDisabled()) {                                
                                // Inverse scale function
                                number = (number - offset) / scale;                                
                                that.write(number);
                            }
                        } else {
                            // TODO: Show tootltip with range
                            input.addClass('rex__input--error');
                            return;
                        }
                    } else {
                        input.addClass('rex__input--error');
                    }
                    break;
            }
        }
    });

    input.keyup(function (evt) {
        let keyCode = evt.keyCode || evt.which;
        if (keyCode === 27) { //ESC keycode
            let setOnBlurTmp = setOnBlur;
            // Temporary disable set on blur behaviour for ESC key
            setOnBlur = false;
            input.blur();
            setOnBlur = setOnBlurTmp;
        }
    });

    function onFocus() {
        that.disableRefresh = true;
    }

    function onBlur() {
        if (setOnBlur) {
            let e = $.Event("keypress");
            e.which = 13; //choose the one you want
            e.keyCode = 13;
            input.trigger(e);
        }
        that.disableRefresh = false;
        that.refresh();
    }

    // Override function from write interface
    that.refresh = function() {
        let value = that.$c.refresh_from.getValue();
        switch (format) {
            case 'date':
                input.val(utils.date2str(utils.getDateFromREXSeconds(value)));
                break;
                case 'time-seconds':
                    timeFormat = 'hh:mm:ss';
                case 'time':
                let totSeconds = value;
                if (!timeFormat && totSeconds % 60 !== 0) { // Show seconds if used
                    timeFormat = 'hh:mm:ss';
                    input.attr('step', 1);
                }
                input.val(utils.time2str(totSeconds, timeFormat));
                break;
            case 'datetime-seconds':
                timeFormat = 'hh:mm:ss';
            case 'datetime':
                let date = utils.getDateFromREXSeconds(value);
                let secs = date.getSeconds() + (60 * (date.getMinutes() + (60 * date.getHours())));
                input.val(utils.date2str(date));
                inputTime.val(utils.time2str(secs,timeFormat));
                break;
            case 'password':
            case 'text':            
                input.val('' + value);
                break;
            default:                
                let resultValue = (value * scale) + offset;
                resultValue = utils.round(resultValue, decimals);
                if(digits > -1){
                    resultValue = resultValue.toString().padStart(digits, '0');
                }
                input.val('' + resultValue);                
                break;
        }
    };

    // Override disable and enable function
    let old_disable = that.disable;
    that.disable = function () {        
        old_disable.apply(this, arguments);
        input.attr("disabled", true);
        if(inputTime){
            inputTime.attr("disabled", true);
        }
    };
    let old_enable = that.enable;
    that.enable = function () {        
        if(old_enable.apply(this, arguments)){
            if(!readOnly){
                input.removeAttr("disabled");
            }
            if(inputTime && !readOnly){
                inputTime.removeAttr("disabled");
            }
        }        
    };

    that.setReadOnly = function(){
        readOnly = true;
        $div.find('input').each(function (/*index, element*/) {            
            let keyboard = $(this).data('keyboard');
            if (keyboard) {
                keyboard.destroy();
            }
            $(this).off().removeData();        
            $(this).attr('disabled',true);
            $(this).addClass('rex__input--read-only');
        });        
    };

    updateFontSize();
    $(window).resize(function () {
        updateFontSize();
    });

    that.disable(true);
    return that;
};
/**
 * SVG component represents Led.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT}
 * @returns {REX.UI.SVG.Led} New SVG Led component
 */

REX.UI.SVG.Led = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem, args);
    // Store options for simple usage
    var $o = that.options || {};

    $o.colorFalse = that.check($o.colorFalse, that.COLORS.false);
    $o.colorTrue = that.check($o.colorTrue, that.COLORS.primary);
    let colorError = that.check($o.colorError, that.COLORS.error);

    let colorTrue = that.parseBoolean($o.reverseMeaning) ? $o.colorFalse : $o.colorTrue;
    let colorFalse = that.parseBoolean($o.reverseMeaning) ? $o.colorTrue : $o.colorFalse;

    // Get SVG elements for manipulation    
    let led = that.getChildByTag("main");
    if(!led){
        that.log.error('You are using the old version of the Led component, do a Full upgrade or replace with new from library.');        
        that.disable();
        // Vypne funkci enable a ukonci ostatni inicializace
        that.enable=function(){};
        return that;
    }

    let $led = $(led);

    that.$c.value.on('change', function (i) {
        if (!that.isDisabled()) {
            refresh();
        }
    });

    if (that.$c.error_by) {
        that.$c.error_by.on('change', function (i) {
            refresh();
        });
    }


    function refresh() {
        if (that.$c.error_by && that.$c.error_by.getValue()) {
            $led.css("fill", colorError);
        }
        else {
            if (that.$c.value.getValue()) {
                $led.css("fill", colorTrue);
            } else {
                $led.css("fill", colorFalse);
            }

        }

    }

    var oldDisable = that.disable;
    that.disable = function () {
        oldDisable.apply(that, arguments);
        $led.css("fill", that.COLORS.false);
    };

    var oldEnable = that.enable;
    that.enable = function () {
        if(oldEnable.apply(that, arguments)){
            refresh();
        }
    };

    return that;
};

/**
 * Status component with label
 * @param svgElem
 * @param args
 * @returns {*}
 * @constructor
 */
REX.UI.SVG.LedLabel = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem,args);
    // Store options for simple usage
    let opt = that.options || {};

    let check = that.utils.check;

    var values = check(opt.values, []);
    let line_height = check(opt.line_height, "1.2em");

    // Get SVG elements for manipulation    
    let labels = []; //tspan    
    // Convert to array
    for (let tspan of that.getChildByTag("label").parentNode.querySelectorAll('tspan')) {
        labels.push(tspan);
    }
    let svgLed = that.getChildByTag("led"); //rect

    // Add default values
    let maxLines = 1;

    for (let val of values) {
        val.value = check(val.value, Number.POSITIVE_INFINITY);
        val.label = check(val.label, "");
        val.fill = check(val.fill, "");
        val.stroke = check(val.stroke, "");
        // Split se dela podle znaku `\n`, protoze v designeru se zapisuje v jednom radkku jako text a tudiz se to escapuje
        let texts = (""+val.label).split('\\n');
        if (texts.length > 1) {
            val.multiline = texts;            
            if (texts.length > maxLines) {
                maxLines = texts.length;
            }
        }
        else {
            val.multiline = [];
        }
    }

    if (maxLines > 1) {
        for (let i = 1; i < maxLines; i++) {
            if (i >= labels.length) {
                // If not available, create one
                let tspan = labels[0].cloneNode();
                tspan.removeAttribute('y');
                tspan.removeAttribute('id');
                tspan.setAttribute('dy', line_height);
                labels.push(tspan);
                labels[0].parentNode.appendChild(tspan);
            }
        }
    }

    that.$c.value.on('change', function (i) {
        if (!that.isDisabled()) {
            refresh();
        }
    });

    function refresh() {
        let value = that.$c.value.getValue();
        let found = false;
        // Delete all text at first
        for(let lbl of labels){
            lbl.textContent = "";
        }
        for (let item of values) {
            if ((Math.abs(item.value - value) < 1e-6)) {
                if (item.label.length > 0) {
                    if (item.multiline.length > 0) {
                        for (let i = 0; i < item.multiline.length; i++) {
                            labels[i].textContent = item.multiline[i];
                        }
                    }
                    else {
                        labels[0].textContent = item.label;
                    }
                }
                if (item.fill) {
                    svgLed.style.fill = item.fill;
                }
                if (item.stroke) {
                    svgLed.style.stroke = item.stroke;
                }
                if (item.color) {
                    for (let lbl of labels) {
                        lbl.style.fill = item.color;
                    }
                }
                found = true;
                break;
            }
        }
        if(!found){
            labels[0].textContent = value;
            svgLed.style.fill = that.COLORS.icon;
        }
    }

    var oldDisable = that.disable;
    that.disable = function () {
        oldDisable.apply(that, arguments);
        //svgLabel.textContent = "";
        svgLed.style.fill = that.COLORS.icon;
    };

    var oldEnable = that.enable;
    that.enable = function () {
        if(oldEnable.apply(that, arguments)){
            refresh();
        }
    };

    return that;
};












/**
 * SVG component represents PushOnOff.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT}
 * @returns {REX.UI.SVG.PushOnOff} New SVG PushOnOff component
 */

REX.UI.SVG.PushOnOff = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem, args);
    // Store options for simple usage
    var $o = that.options || {};

    // Get options or default values
    var type = that.check($o.type,'PushButton');
    var onMouseDownValue = that.parseBoolean($o.reverseMeaning) ? 0 : 1;
    var colorFalse = that.check($o.colorFalse, "#FFFFFF");
    var colorTrue = that.check($o.colorTrue, that.COLORS.primary);
    
    // Heuristika. Pokud neni pro MP definovan cteci bod, pak se bude pouzivat pouze color False
    if(!that.$c.refresh_from && (type === 'ManualPulse' || type === 'ManualPulseRpt')){        
        colorTrue = colorFalse;
    }

    // Add `write` and `refresh` functions. Necessary for all write components 
    // with *value* and  *refresh_from* items.
    that.addWriteInterface();

    // Get SVG elements for manipulation
    var baseEl = that.getChildByTag("button"),
        mainEl = that.getChildByTag("main"),  
        hoverEl = that.getChildByTag("hover"),
        activeEl = that.getChildByTag("active");

    //Global variables
    // var centerX = baseEl.getBBox().width / 2;
    // var centerY = baseEl.getBBox().height / 2;                
    var pressed = false,
        over = false,
        active = false;

    if (!baseEl) {
        that.log.error('You are using the old version of the PushOnOff component, do a Full upgrade or replace with new from library.');        
        that.disable();
        // Vypne funkci enable a ukonci ostatni inicializace
        that.enable=function(){};
        return that;
    }

    if (type === 'ToggleButton' && that.$c.value !== that.$c.refresh_from) {
        that.log.error(`Refresh_from datapoint is not supported in the Toggle mode!`);        
        that.disable();
        // Vypne funkci enable a ukonci ostatni inicializace
        that.enable=function(){};
        return that;
    }    


    that.refresh = function() {        
        let value = that.$c.refresh_from.getValue();
        if (value === (1 - onMouseDownValue) || value === null) {
            active = false;            
            mainEl.style.fill = colorFalse;
            
        }
        else {
            active = true;            
            mainEl.style.fill = colorTrue;
        }
    };
    
    function stateHover(){
        hoverEl.style.display = 'block';
        activeEl.style.display = 'none';
    }

    function stateActive(){
        hoverEl.style.display = 'none';
        activeEl.style.display = 'block';
    }

    function stateNone(){
        hoverEl.style.display = 'none';
        activeEl.style.display = 'none';
    }

    $(baseEl).bind('mouseenter', function (evt) {
        over = true;                                
        stateHover();
    }).bind('touchstart mousedown', function (evt) {
        evt.preventDefault();
        if (evt.handled !== true) {
            if (!(evt.button && evt.button > 0)) {
                if (type === 'ToggleButton') {
                    if (!active) {
                        that.write(onMouseDownValue);
                        active = true;
                    }
                    else {
                        that.write(1 - onMouseDownValue);
                        active = false;
                    }
                }
                else if (type === 'ManualPulseRpt') {
                    let loopWrite = () => {
                        that.$c.value.write(onMouseDownValue)
                            .then(() => {
                                setTimeout(() => {
                                    if (pressed) { loopWrite(); }
                                }, 20);
                            })
                            .catch(that.writeFailed);
                    };
                    loopWrite();                    
                }
                else {                    
                    that.write(onMouseDownValue);
                }
                pressed = true;         
                stateActive();
                that.emit('mousedown');
            }
            evt.handled = true;
        } else {
            return false;
        }
    }).bind('touchend touchcancel touchleave mouseup mouseleave', function (evt) {
        evt.preventDefault();                
        if (evt.type === 'mouseup') {                
            stateHover();
        } else {                
            stateNone();
        }        
        over = false;
        if (evt.handled !== true) {
            // Primary mouse button only       
            // Invoke only when the button was pressed before
            if (!(evt.button && evt.button > 0) && pressed) {                
                if (type === 'PushButton') {
                    that.write(1 - onMouseDownValue);
                }
                that.emit('mouseup');
                pressed = false;
            }
        } else {
            return false;
        }
    }).bind('contextmenu', (evt) => { 
        // Disable context menu
        evt.preventDefault();
    });

    that.setReadOnly = function(){
        that.readOnly = true;
        pressed = false;
        $(baseEl).off()
        .removeData()
        .css('pointer-events','none');
        stateNone();
    };

    var oldDisable = that.disable;
    that.disable = function () {
        oldDisable.apply(that, arguments);        
        stateNone();
        pressed = false; // Vypne MPRpt
        that.refresh();
    };

    var oldEnable = that.enable;
    that.enable = function () {
        if(oldEnable.apply(that, arguments)){
            that.refresh();
        }
    };

    var oldHide = that.hide;
    that.hide = function () {
        oldHide.apply(that,arguments);        
        pressed = false; // Vypne MPRpt
    };
    
    return that;
};

/**
 * SVG component represents SimpleLogger.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT} 
 * @returns {SimpleLogger} New HTML component
 */
REX.UI.SVG.SimpleLogger = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.HTMLComponent(svgElem, args);
    var $div = $(that.div);
    
    var $o = that.options || {};
    var lines = that.checkNumber($o.lines, 1);
    var timestamp = that.parseBoolean($o.timestamp);
    var showValue = that.parseBoolean($o.showValue);
    var ignoreEmptyValues = that.parseBoolean($o.ignoreEmptyValues);    
    var format = $o.format || "alt";
    var timestampFormat = that.check($o.timestampFormat, "HH:MM:SS");
    var useTargetTime = that.parseBoolean($o.useTargetTime);    
    
    

    $div.css({"white-space":"pre-wrap","overflow-x": "hidden","overflow-y": "auto","text-align": "left"});
    $div.addClass("rexhmi-ui-svg-simplelogger");

    if ($o.css) {
        if (typeof $o.css === 'object') {
            $div.css($o.css);
        }
        else {
            that.log.error(that.id + "css property is not an object. Write it as a value pair JSON object");
        }
    }
    
    var texts = {};
    // If text is defined than convert array to object where key is id (number)
    // and value is text
    if ($o.texts && $o.texts.length > 0) {
        var result = {};
        for (var i = 0; i < $o.texts.length; i++) {
            result[$o.texts[i].value] = $o.texts[i].desc;
        }
        texts = result;
    }

    that.$c.value.on('change', function (itm) {
        var log_msg = '<div>';
        let val = "";
        if (timestamp) {
            var actDate = useTargetTime ? that.getDateFromREXNanoseconds(itm.timestamp) : new Date();
            let strTstamp = Globalize.format(actDate, timestampFormat);
            log_msg += '<span class="logger-timestamp">' + strTstamp + '</span>';
        }
        if (showValue) {
            val = ('' + itm.getValue()).trim();
            log_msg += "<span class='logger-value'>" + val + ":</span>";
        }
        log_msg += "<span class='logger-desc'>";
        switch (format.toLowerCase()) {
            case 'text':
                let msg = ('' + itm.getValue()).trim();
                // Nezobrazuj radek, ktery nema zadny popisek
                if (msg.length === 0 && ignoreEmptyValues) {
                    return;
                }
                else {
                    log_msg += msg;
                }
                break;
            default:
                if (texts[itm.getValue()])
                    log_msg += texts[itm.getValue()];
                else {
                    // Nezobrazuj radek, ktery nema zadny popisek
                    if (ignoreEmptyValues) {
                        return;
                    }
                    log_msg += ('' + itm.getValue()).trim();
                }
                break;
        }
        log_msg += '</span></div>';
        $div.prepend(log_msg);
        if ($div.children().length > lines) {
            $div.children().last().remove();
        }
        //$div.scrollTop($div[0].scrollHeight);
    });

    // Override disable and enable function
    var old_disable = that.disable;
    that.disable = function () {
        $div.addClass('ui-state-disabled');
        old_disable.apply(this, arguments);
    };
    var old_enable = that.enable;
    that.enable = function () {        
        if(old_enable.apply(this, arguments)){
            $div.removeClass('ui-state-disabled');
        }
    };

    that.disable(true);
    return that;
};
/**
 * SVG component represents Slider.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT}
 * @returns {REX.UI.SVG.Slider} New SVG Slider component
 */

REX.UI.SVG.SliderHorizontal = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem, args);
    // Store options for simple usage
    var $o = that.options || {};

    // Add `write` and `refresh` functions. Necessary for all write components 
    // with *value* and  *refresh_from* items.
    that.addWriteInterface();

    // Get SVG elements for manipulation
    var sliderArea = that.getChildByTag("slider_area"),
        level = that.getChildByTag("slider_level"),
        levelBox = that.getChildByTag("slider_capacity"),
        dragPoint = that.getChildByTag("drag_point"),
        digitalValue = that.getChildByTag("digitalval"),
        textBox = that.getChildByTag("text_box");
    // Deprecated warning
    if (!textBox) { that.log.warn(that.id + ': Please upgrade this component'); }

    //Load options or default values
    var min = that.checkNumber($o.min, 0),
        max = that.checkNumber($o.max, 1),
        step = that.checkNumber($o.step, 1),
        scale = that.checkNumber($o.scale, 1),
        offset = that.checkNumber($o.offset, 0),
        decimals = that.checkNumber($o.decimals, 0),
        fScale = that.checkNumber($o.fontScale, 1),
        fSize = fScale * 18,
        label = $o.label || "",
        writeOnChange = that.parseBoolean($o.writeOnChange);

    digitalValue.style.fontSize = (fScale * 18) + "px";
    

    //Global variables
    var setPoint,
        setPointChanged = false,
        sliderActive = false,
        writeEnabled = true,
        activeArea = null,
        activePoint = null,
        disableRefresh = false;
    
    initComponentDone = false;


    // GetBBox methods is used here, init can be done when the getBBox is available    
    function initComponent() {
        if(initComponentDone){return;}
        if(!that.testBBox()){return;}
        
        createLabel();
        activeArea = createActiveArea(),
        activePoint = activeArea.createSVGPoint();
        initComponentDone = true;
    };    


    $(sliderArea).on('touchstart mousedown', sliderDown)
        .on('contextmenu', function (e) { e.stopPropagation(); return false; });
    $(window).on('touchmove mousemove', sliderMove);
    $(window).on('touchend touchcancel mouseup', sliderUp);


    that.refresh = function () {
        initComponent();
        if (!initComponentDone) {
            return;
        }

        if (!disableRefresh) {
            updateSlider((that.$c.refresh_from.getValue() * scale) + offset);
        }
    };

    function sendActiveStatus(active) {
        if (!that.$c.active) {
            return;
        }
        // Start peridically updating the status when the slider is active
        that.$c.active.write(active)
            .then(() => {
                setTimeout(() => {
                    if (sliderActive) { sendActiveStatus(active); }
                }, 20);
            })
            .catch((err) => {
                that.writeFailed(err);
            });
    }

    function writeValue() {
        if (writeEnabled) {
            var value = (parseFloat(setPoint) - offset) / scale;
            that.$c.value.write(value)
                .then(() => {
                    writeEnabled = true;
                })
                .catch((err) => {
                    that.writeFailed(err);
                    writeEnabled = true;
                });
            if (that.$c.value !== that.$c.refresh_from) {
                that.$c.refresh_from.setValue(value);
            }
            writeEnabled = false;
        }
    }

    function sliderDown(event) {
        event.stopPropagation();
        sliderActive = true;
        disableRefresh = true;
        updatePosition(event);
        if (that.$c.active) { writeValue(); }
        sendActiveStatus(true);
    }

    function sliderMove(event) {     
        if (sliderActive) {
            updatePosition(event);
            if (writeOnChange) {
                writeValue();
            }
        }
    }

    function sliderUp(event) {
        if (sliderActive) {
            disableRefresh = false;
            // To be sure that the sliderUp value will be written to the target
            writeEnabled = true;
            writeValue();
            sliderActive = false;
            sendActiveStatus(false);
        }
    }

    function updatePosition(event) {
        activePoint.x = typeof event.pageX !== 'undefined' ? event.pageX : event.originalEvent.touches[0].pageX;
        activePoint.y = typeof event.pageY !== 'undefined' ? event.pageY : event.originalEvent.touches[0].pageY;
        var newPoint = coordinateTransform(activePoint, activeArea);
        var position = newPoint.x;
        setValue(position);
        if (sliderActive) {
            // Saturace na meze slideru
            if (position < 0) {
                position = 0;
            }
            else if (position > levelBox.getBBox().width + 1) {
                position = levelBox.getBBox().width + 1;
            }

            dragPoint.setAttributeNS(null, "transform", "translate(" + parseFloat(position) + "," + 0 + ")");
            level.setAttributeNS(null, "width", position);
            digitalValue.textContent = setPoint.toFixed(decimals);
            transformDisplay();
        }
    }

    function setValue(val) {
        var relativeStep = (levelBox.getBBox().width) / (Math.abs(max - min) / step);
        if (val % relativeStep < relativeStep) {
            setPoint = min + Math.round(val / relativeStep) * step;
            if (setPoint < min) {
                setPoint = min;
            }
            else if (setPoint > max) {
                setPoint = max;
            }
        }
    }

    function updateSlider(setPointValue) {
        var setP = setPointValue;
        var position;
        if (setP >= min && setP <= max) {
            position = (setP - min) * (levelBox.getBBox().width) / Math.abs(max - min);
        } else {
            if (setP < min) {
                setP = min;
                position = 0;
            }
            else {
                setP = max;
                position = levelBox.getBBox().width;
            }
        }
        digitalValue.textContent = setP.toFixed(decimals);
        transformDisplay();
        dragPoint.setAttributeNS(null, "transform", "translate(" + parseFloat(position) + "," + 0 + ")");
        level.setAttributeNS(null, "width", position);
    }

    function coordinateTransform(screenPoint, someSvgObject) {
        var CTM = someSvgObject.getScreenCTM();
        if (/Firefox[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
            var newCoordinates = screenPoint.matrixTransform(CTM.inverse());
            newCoordinates.x -= (levelBox.getBBox().x);
            return newCoordinates;
        } else {
            return screenPoint.matrixTransform(CTM.inverse());
        }
    }

    function createActiveArea() {
        var area = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
        area.setAttribute('x', levelBox.getBBox().x);
        area.setAttribute('y', levelBox.getBBox().y);
        area.setAttribute('width', levelBox.getBBox().width);
        area.setAttribute('height', levelBox.getBBox().height);
        sliderArea.appendChild(area);
        return area;
    }

    function createLabel() {
        var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttributeNS(null, "fill", "#ffffff");
        text.setAttributeNS(null, "style", "font-size:" + fSize + "px; font-family:Arial");
        text.textContent = label;
        sliderArea.appendChild(text);
        text.setAttributeNS(null, "x", levelBox.getBBox().x + levelBox.getBBox().width / 2 - text.getBBox().width / 2);
        text.setAttributeNS(null, "y", (levelBox.getBBox().y + levelBox.getBBox().height + text.getBBox().height * 1.1));
    }

    function transformDisplay() {
        if (textBox) {
            var fontSize = digitalValue.style.fontSize;
            if (digitalValue.parentNode.getBBox().width >= textBox.getBBox().width * 0.9) {
                digitalValue.style.fontSize = parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 0.9 + "px";
            }
            else if (digitalValue.parentNode.getBBox().width < textBox.getBBox().width * 0.85 && parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 1.05 < fSize) {
                digitalValue.style.fontSize = parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 1.05 + "px";
            }
            digitalValue.parentNode.setAttributeNS(null, "transform", "translate(" + parseInt(textBox.getBBox().x + (textBox.getBBox().width / 2
                    - digitalValue.parentNode.getBBox().width / 2) - digitalValue.parentNode.getBBox().x) + "," + parseInt(textBox.getBBox().y +
                    (textBox.getBBox().height / 2 - digitalValue.parentNode.getBBox().height / 2) - digitalValue.parentNode.getBBox().y) + ")");
        }
    }

    that.setReadOnly = function () {
        that.readOnly = true;
        $(sliderArea).off().removeData();
        $(sliderArea).css('pointer-events', 'none');
        sliderActive = false;
    };

    initComponent();
    that.disable(true);
    return that;
};
/**
 * SVG component represents Slider.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT}
 * @returns {REX.UI.SVG.Slider} New SVG Slider component
 */

REX.UI.SVG.SliderVertical = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem, args);
    // Store options for simple usage
    var $o = that.options || {};

    // Add `write` and `refresh` functions. Necessary for all write components 
    // with *value* and  *refresh_from* items.
    that.addWriteInterface();

    // Get SVG elements for manipulation
    var sliderArea = that.getChildByTag("slider_area"),
        level = that.getChildByTag("slider_level"),
        levelBox = that.getChildByTag("slider_capacity"),
        dragPoint = that.getChildByTag("drag_point"),
        digitalValue = that.getChildByTag("digitalval"),
        textBox = that.getChildByTag("text_box");        

    // Deprecated warning
    if (!textBox) { that.log.warn(that.id + ': Please upgrade this component'); }

    //Load options or default values
    var min = that.checkNumber($o.min, 0),
        max = that.checkNumber($o.max, 1),
        step = that.checkNumber($o.step, 1),
        scale = that.checkNumber($o.scale, 1),
        offset = that.checkNumber($o.offset, 0),
        decimals = that.checkNumber($o.decimals, 0),
        fScale = that.checkNumber($o.fontScale, 1),
        fSize = fScale * 18,
        label = $o.label || "",
        writeOnChange = that.parseBoolean($o.writeOnChange);
    
        
    //Global variables
    var setPoint,
        setPointChanged = false,
        sliderActive = false,
        writeEnabled = true,
        activeArea = null,
        activePoint = null,
        disableRefresh = false;
    var initComponentDone = false;

    // GetBBox methods is used here, init can be done when the getBBox is available    
    function initComponent() {
        if(initComponentDone){return;}
        if(!that.testBBox()){return;}

        digitalValue.style.fontSize = (fScale * 18) + "px";
        createLabel();
        level.setAttributeNS(null, "transform", "rotate(" + 180 + "," + (levelBox.getBBox().x +
        levelBox.getBBox().width / 2) + "," + (levelBox.getBBox().y + levelBox.getBBox().height) + ")");

        activeArea = createActiveArea(),
        activePoint = activeArea.createSVGPoint();
        initComponentDone = true;
    };

    $(sliderArea).on('touchstart mousedown', sliderDown)
        .on('contextmenu', function (e) { e.stopPropagation(); return false; });
    $(window).on('touchmove mousemove', sliderMove);
    $(window).on('touchend touchcancel mouseup', sliderUp);

    that.refresh = function () {
        initComponent();
        if (!initComponentDone) {
            return;
        }

        if (!disableRefresh) {
            updateSlider((that.$c.refresh_from.getValue() * scale) + offset);
        }
    };

    function sendActiveStatus(active) {
        if (!that.$c.active) {
            return;
        }
        // Start peridically updating the status when the slider is active
        that.$c.active.write(active)
            .then(() => {
                setTimeout(() => {
                    if (sliderActive) { sendActiveStatus(active); }
                }, 20);
            })
            .catch((err) => {
                that.writeFailed(err);
            });
    }

    function writeValue() {
        if (writeEnabled) {
            var value = (parseFloat(setPoint) - offset) / scale;
            that.$c.value.write(value)
                .then(() => {
                    writeEnabled = true;
                })
                .catch((err) => {
                    that.writeFailed(err);
                    writeEnabled = true;
                });
            if (that.$c.value !== that.$c.refresh_from) {
                that.$c.refresh_from.setValue(value);
            }
            writeEnabled = false;
        }
    }

    function sliderDown(event) {
        event.stopPropagation();
        sliderActive = true;
        disableRefresh = true;
        updatePosition(event);
        if (that.$c.active) { writeValue(); }
        sendActiveStatus(true);
    }

    function sliderMove(event) {        
        if (sliderActive) {
            updatePosition(event);
            if (writeOnChange) {
                writeValue();
            }
        }
    }

    function sliderUp(event) {
        if (sliderActive) {
            disableRefresh = false;
            // To be sure that the sliderUp value will be written to the target
            writeEnabled = true;
            writeValue();
            sliderActive = false;
            sendActiveStatus(false);
        }
    }

    function updatePosition(event) {
        activePoint.x = typeof event.pageX !== 'undefined' ? event.pageX : event.originalEvent.touches[0].pageX;
        activePoint.y = typeof event.pageY !== 'undefined' ? event.pageY : event.originalEvent.touches[0].pageY;
        var newPoint = coordinateTransform(activePoint, activeArea);
        var position = levelBox.getBBox().height - newPoint.y;
        setValue(position);
        if (sliderActive) {
            // Saturace na meze slideru
            if (position < 0) {
                position = 0;
            }
            else if (position > levelBox.getBBox().height + 1) {
                position = levelBox.getBBox().height + 1;
            }
            dragPoint.setAttributeNS(null, "transform", "translate(" + 0 + "," + -parseFloat(position) + ")");
            level.setAttributeNS(null, "height", position);
            digitalValue.textContent = setPoint.toFixed(decimals);
            transformDisplay();            
        }
    }

    function setValue(val) {
        var relativeStep = (levelBox.getBBox().height) / (Math.abs(max - min) / step);
        if (val % relativeStep < relativeStep) {
            setPoint = min + Math.round(val / relativeStep) * step;
            if (setPoint < min) {
                setPoint = min;
            }
            else if (setPoint > max) {
                setPoint = max;
            }
        }
    }

    function updateSlider(setPointValue) {
        var setP = setPointValue;
        var position;
        if (setP >= min && setP <= max) {
            position = (setP - min) * (levelBox.getBBox().height) / Math.abs(max - min);
        } else {
            if (setP < min) {
                setP = min;
                position = 0;
            }
            else {
                setP = max;
                position = levelBox.getBBox().height;
            }
        }
        digitalValue.textContent = setP.toFixed(decimals);
        transformDisplay();
        dragPoint.setAttributeNS(null, "transform", "translate(" + 0 + "," + -parseFloat(position) + ")");
        level.setAttributeNS(null, "height", position);
    }

    function coordinateTransform(screenPoint, someSvgObject) {
        var CTM = someSvgObject.getScreenCTM();
        if (/Firefox[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
            var newCoordinates = screenPoint.matrixTransform(CTM.inverse());
            newCoordinates.y -= (levelBox.getBBox().y);
            return newCoordinates;
        } else {
            return screenPoint.matrixTransform(CTM.inverse());
        }
    }

    function createActiveArea() {
        var area = document.createElementNS("http://www.w3.org/2000/svg", 'svg');
        area.setAttribute('x', levelBox.getBBox().x);
        area.setAttribute('y', levelBox.getBBox().y);
        area.setAttribute('width', levelBox.getBBox().width);
        area.setAttribute('height', levelBox.getBBox().height);
        sliderArea.appendChild(area);
        return area;
    }

    function createLabel() {
        var text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        var oldWidth = sliderArea.getBBox().width;
        text.setAttributeNS(null, "fill", "#ffffff");
        text.setAttributeNS(null, "style", "font-size:" + fSize + "px; font-family:Arial");
        text.textContent = label;
        sliderArea.appendChild(text);
        // Resize font size if needed
        if (text.getBBox().width > oldWidth) {
            var newFontSize = (oldWidth / text.getBBox().width) * fSize * 0.98;
            text.setAttributeNS(null, "style", "font-size:" + newFontSize.toFixed(3) + "px; font-family:Arial");
        }
        text.setAttributeNS(null, "x", levelBox.getBBox().x + levelBox.getBBox().width / 2 - text.getBBox().width / 2);
        text.setAttributeNS(null, "y", (levelBox.getBBox().y + levelBox.getBBox().height + text.getBBox().height * 1.1));
    }

    function transformDisplay() {
        if (textBox) { // For backward compatibility
            var fontSize = digitalValue.style.fontSize;
            if (digitalValue.parentNode.getBBox().width >= textBox.getBBox().width * 0.9) {
                digitalValue.style.fontSize = parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 0.9 + "px";
            }
            else if (digitalValue.parentNode.getBBox().width < textBox.getBBox().width * 0.85 && parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 1.05 < fSize) {
                digitalValue.style.fontSize = parseFloat(fontSize.substring(0, fontSize.indexOf('p'))) * 1.05 + "px";
            }
            digitalValue.parentNode.setAttributeNS(null, "transform", "translate(" + parseInt(textBox.getBBox().x + (textBox.getBBox().width / 2
                    - digitalValue.parentNode.getBBox().width / 2) - digitalValue.parentNode.getBBox().x) + "," + parseInt(textBox.getBBox().y +
                    (textBox.getBBox().height / 2 - digitalValue.parentNode.getBBox().height / 2) - digitalValue.parentNode.getBBox().y) + ")");
        }
    }
    
    that.setReadOnly = function () {
        that.readOnly = true;
        $(sliderArea).off().removeData();
        $(sliderArea).css('pointer-events', 'none');
        sliderActive = false;
    };

    initComponent();
    that.disable(true);
    return that;
};
/**
 * SVG component represents Switch.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT}
 * @returns {REX.UI.SVG.Switch} New SVG Switch component
 */

REX.UI.SVG.Switch = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem, args);
    // Store options for simple usage
    var $o = that.options || {};
    var hideTooltips = that.parseBoolean($o.hideTooltips);

    // Get options or default values
    var positions = that.check($o.positions, []);

    // Add `write` and `refresh` functions. Necessary for all write components 
    // with *value* and  *refresh_from* items.
    that.addWriteInterface();

    // Get SVG elements for manipulation
    var switchArea = SVG.adopt(that.getChildByTag("switch-area")),
        $switchArea = $(switchArea.node),        
        base = SVG.adopt(that.getChildByTag("base")),
        dotsArea = SVG.adopt(that.getChildByTag("dots-area")),
        dot = that.getChildByTag("dot"),
        hand = that.getChildByTag("hand"),
        tRotate = hand.transform.baseVal[0],
        handTip = that.getChildByTag("hand-tip"),
        hover = [SVG.adopt(that.getChildByTag("hand-hover")),SVG.adopt(that.getChildByTag("base-hover"))];

    $switchArea.css('cursor', 'pointer');

    //Global variables
    let centerX = switchArea.bbox().cx,
        centerY = switchArea.bbox().cy,
        rotCx = 46.138352, // Prevzato z Inkscapu
        rotCy = 46.148273,        
        radius = 46.13835,
        pointRadius = 1.684,
        pointDefaultFill = dot.style.fill || "#aeb3bb",        
        pointActiveFill = that.check($o.colorActive, that.COLORS.primary),
        currentPointIndex = 0,
        newPointIndex = -1,
        points = [],
        pointAngle = 360 / positions.length,
        timeout,
        lastTap = 0,
        animationSpeed = 4,
        currentRotation = 0;

    dotsArea.clear();
    // Inicializace jednotlivych mist pro prepinani
    for (let i = 0; i < positions.length; i++) {
        let angle = 90 - pointAngle * i;        
        if(angle<0){
            angle = (360 + angle);
        }
        angle = angle%360;
        
        let value = parseFloat(positions[i].valueOfPosition);
        points[i] = {
            element: null,
            value: (value !== Number.NaN) ? value : positions[i].valueOfPosition,
            angle: angle,
            type: (value !== Number.NaN) ? 'number' : 'text'
        };

        let svgPoint = createSVGpoint(angle, points[i].value);
        points[i].element = svgPoint;
        dotsArea.node.append(svgPoint);

        svgPoint.dataset.pointid = i; // Save index to data-pointID attribute of the element            
        $(svgPoint)
            .on('mouseenter', () => {
                svgPoint.style.fill = pointActiveFill;
            })
            .on('mouseleave', () => {
                if(currentPointIndex !==i){
                    svgPoint.style.fill = pointDefaultFill;
                }                
            })
            .on('mouseup', () => {       
                newPointIndex = i;                         
                that.write(points[i].value);
            });
    }

    function createSVGpoint(angle,value) {
        var x = centerX + radius * Math.cos(angle * Math.PI / 180);
        var y = centerY - radius * Math.sin(angle * Math.PI / 180);

        let g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.style.fill = pointDefaultFill;
        g.style.stroke = 'none';
        g.style.cursor = 'pointer';

        let hover = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        hover.setAttributeNS(null, "cx", x);
        hover.setAttributeNS(null, "cy", y);
        hover.setAttributeNS(null, "r", 6.5 * pointRadius);
        hover.style.stroke = 'none';
        hover.style.opacity = 0;
        // Debug
        // hover.style.fill = 'blue';
        // hover.style.opacity = 0.25;

        var svgPoint = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        svgPoint.setAttributeNS(null, "cx", x);
        svgPoint.setAttributeNS(null, "cy", y);
        svgPoint.setAttributeNS(null, "r", pointRadius);
        g.append(hover);
        g.append(svgPoint);

        if(!hideTooltips){
            var tooltip = document.createElementNS("http://www.w3.org/2000/svg", "title");
            tooltip.textContent = ""+value;        
            g.append(tooltip);        
        }
        
        return g;
    }

    function stateHover() {
        for (let h of hover) {
            h.show();
        }
    }

    function stateNone() {
        for (let h of hover) {
            h.hide();
        }
    }

    $switchArea.css('cursor', 'pointer');

    $switchArea.bind('contextmenu', (evt) => {
        // Disable context menu
        evt.preventDefault();
    })
    .bind('mouseenter', function (evt) {
        stateHover();
    }).bind('touchstart mousedown', function (evt) {
        evt.preventDefault();
        // if (!active) {
        //     that.$c.value.write(!reverse_meaning).catch(writeFailed);
        // } else {
        //     that.$c.value.write(reverse_meaning).catch(writeFailed);
        // }
    }).bind('touchend mouseup', function (evt) {
        if(evt.button === 2){ // Disable right mouse button
            return;
        }
        var currentTime = new Date().getTime();
        var tapLength = currentTime - lastTap;
        clearTimeout(timeout);
        if (tapLength < 500 && tapLength > 0) {
            // Double Tap
            // Rotate CCW
            let pos = currentPointIndex-1;
                if(pos < 0){
                    pos = points.length-1;
                }  
                newPointIndex = pos;                                           
                that.write(points[pos].value);
            event.preventDefault();
            // Prevent sencond double-tap in row
            lastTap = currentTime-501;
        } else {
            // Single Tap
            timeout = setTimeout(function() {
                // Single Tap (timeout)
                // Rotate CW
                let pos = currentPointIndex+1;
                if(pos >= points.length){
                    pos = 0;
                }                
                newPointIndex = pos;               
                that.write(points[pos].value);
                clearTimeout(timeout);
            }, 500);
            lastTap = currentTime;
        }

        if (evt.type === 'mouseup') {
            stateHover();
        } else {
            stateNone();
        }
    })
    .bind('touchend touchcancel touchleave mouseleave', function (evt) {
        evt.preventDefault();
        stateNone();
    });

    /**
     * vraci hodnotu uhlu beta_rec posunutou o periodu 2*pi od beta tak, aby posun z alpha
       do beta byl po minimalni vzdalenosti
     */
    function minAngleDist(alpha, beta) {
        alpha = alpha * Math.PI / 180;
        beta = beta * Math.PI / 180;
        // let dir = Math.sin(beta - alpha);
        // return alpha + Math.sign(dir)*Math.acos(Math.cos(alpha-beta));

        return Math.atan2(Math.sin(alpha - beta), Math.cos(alpha - beta)) * 180 / Math.PI;
    }

    let targetAngle;
    let currentRotationDir = 0;
    function animate() 
    {
        targetAngle = points[currentPointIndex].angle;
        if (targetAngle !== currentRotation) {
            // Zjistim kam se mam otacet
            if (currentRotationDir === 0) {
                currentRotationDir = minAngleDist(targetAngle, currentRotation) < 0 ? -1 : 1;
            }
            if (currentRotationDir > 0) {
                currentRotation += animationSpeed;
                if (currentRotation >= 360) {
                    currentRotation = currentRotation % 360;
                }
            } else {
                currentRotation -= animationSpeed;
                if (currentRotation < 0) {
                    currentRotation = 360 + currentRotation;
                }
            }
            // if (Math.abs((360 - currentRotation + targetAngle)) < (currentRotation - targetAngle) || currentRotation < targetAngle) {
            //     currentRotation += animationSpeed;
            //     if (currentRotation > 360) {
            //         currentRotation = currentRotation % 360;
            //     }
            // } else {
            //     currentRotation -= animationSpeed;
            //     if (currentRotation < 0) {
            //         currentRotation = 360 + currentRotation;
            //     }                
            // }

            if(Math.abs(targetAngle - currentRotation)<animationSpeed){
                currentRotation = targetAngle;
                currentRotationDir = 0;
            }            
        }
        tRotate.setRotate(90 - currentRotation, rotCx, rotCy);

        if((currentRotation !== targetAngle)){
            animationID = requestAnimationFrame( animate );
        }        
    }

    function equals(val1, val2) {
        if (that.utils.isNumber(val1) && that.utils.isNumber(val2)) {
            return Math.abs(val1 - val2) < 1E-6;
        }
        else{
            return val1 == val2;
        }
    }

    that.refresh = function() {
        let value = that.$c.refresh_from.getValue();
        let dist = Number.MAX_VALUE;
        let closestPointIndex = -1;

        for (let i = 0; i < points.length; i++) {
            points[i].element.style.fill = pointDefaultFill;            
        }

        if(value === null){
            return;
        }
        
        // Value is in switch position list
        if (!points[newPointIndex] || !equals(value, points[newPointIndex].value)) {
            for (let i = 0; i < points.length; i++) {
                if (equals(points[i].value, value)) { // Position found
                    newPointIndex = i;
                    break;
                } else {
                    newPointIndex = -1;
                    if(points[i].type === 'number'){
                        try {
                            let tmpDist = Math.abs(points[i].value - value);
                            if (tmpDist < dist) {
                                dist = tmpDist;
                                closestPointIndex = i;
                            }
                        } catch (err) {
                            // do nothing
                        }
                    }
                }
            }
        }        

        if (newPointIndex >= 0) {
            points[newPointIndex].element.style.fill = pointActiveFill;
            handTip.style.fill = pointActiveFill;
        }
        else{
            handTip.style.fill = pointDefaultFill;
        }

        let angle;
        if (newPointIndex < 0) {
            if (closestPointIndex === -1) { // If switch uses text values
                closestPointIndex = 0;
            }
            angle = value < points[closestPointIndex].value ?
                points[closestPointIndex].angle + pointAngle / 2 :
                points[closestPointIndex].angle - pointAngle / 2;
            currentPointIndex = closestPointIndex;
        } else {
            angle = points[newPointIndex].angle;
            currentPointIndex = newPointIndex;
        }

        if (tRotate) {
            if(requestAnimationFrame){    
                currentRotationDir = 0;
                animate();
            }   
            else{                
                tRotate.setRotate(90 - angle, rotCx, rotCy);
            }                             
        }
        else { // Deprecated
            hand.setAttributeNS(null, "transform", "rotate(" + 90-angle + "," + rotCx + "," + rotCy + ")");
            currentPointIndex = newPointIndex;
        }
    };

    var oldDisable = that.disable;
    that.disable = function () {
        oldDisable.apply(that, arguments);
        $switchArea.css('pointer-events', 'none');
        for (let p of points) {
            p.element.style['pointer-events'] = 'none';
        }
        that.refresh();
    };

    var oldEnable = that.enable;
    that.enable = function () {
        if (oldEnable.apply(that, arguments)) {
            $switchArea.css('pointer-events', '');
            for (let p of points) {
                p.element.style['pointer-events'] = '';
            }
            that.refresh();
        }
    };

    that.setReadOnly = function () {
        that.readOnly = true;
        stateNone();
        $switchArea.off().removeData();
        $switchArea.css('pointer-events', 'none');

        for(let p of points){
            p.element.style['pointer-events'] = 'none';
            $(p.element.style).off().removeData();
        }        
    };

    return that;
};

/**
 * SVG component represents Switch.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT}
 * @returns {REX.UI.SVG.Switch} New SVG Switch component
 */

REX.UI.SVG.SwitchOnOff = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.Component(svgElem, args);
    // Store options for simple usage
    var $o = that.options || {};

    // Get options or default values
    var reverse_meaning = that.parseBoolean($o.reverse_meaning);
    var labelColorFalse = that.check($o.labelColorFalse, that.COLORS.primary);
    var labelColorTrue = that.check($o.labelColorTrue, that.COLORS.primary);

    // Add `write` and `refresh` functions. Necessary for all write components 
    // with *value* and  *refresh_from* items.
    that.addWriteInterface();

    // Get SVG elements for manipulation
    var $switchArea = $(that.getChildByTag("switch-area")),
        hand = that.getChildByTag("hand"),
        tRotate = hand.transform.baseVal[0],
        handTip = that.getChildByTag("hand-tip"),
        textOff = that.getChildByTag("text-off"),
        textOn = that.getChildByTag("text-on"),
        hover = [SVG.adopt(that.getChildByTag("hand-hover")),SVG.adopt(that.getChildByTag("base-hover"))];

    //Global variables
    var animationID = null,
        active = false,
        currentRotation = 0,
        // Konstanty z rotace v SVG
        centerX = 46.068644,
        centerY = 45.139085,        
        angle = 38,
        animationSpeed = 4,
        textOffDefaultFill = textOff.style.fill,
        textOnDefaultFill = textOn.style.fill;

    // Pokud ma tspan definovanou jinou barvu, tak si ji zapamatuju a zrusim mu ten atribut
    if (textOff.firstChild && textOff.firstChild.style && textOff.firstChild.style.fill &&
        textOff.firstChild.style.fill !== textOffDefaultFill) {
        textOffDefaultFill = textOff.firstChild.style.fill;
        textOff.firstChild.style.fill = '';
    }

    if (textOn.firstChild && textOn.firstChild.style && textOn.firstChild.style.fill &&
        textOn.firstChild.style.fill !== textOnDefaultFill) {
        textOnDefaultFill = textOn.firstChild.style.fill;
        textOn.firstChild.style.fill = '';
    }

    $switchArea.css('cursor', 'pointer');

    $switchArea.bind('mouseenter', function (evt) {
        stateHover();
    }).bind('touchstart mousedown', function (evt) {
        evt.preventDefault();
        if (!active) {
            let val = !reverse_meaning ? 1 : 0;
            that.write(val);
        } else {
            let val = reverse_meaning ? 1 : 0;
            that.write(val);
        }
    }).bind('touchend touchcancel touchleave mouseup mouseleave', function (evt) {
        evt.preventDefault();
        if (evt.type === 'mouseup') {
            stateHover();
        } else {
            stateNone();
        }
    }).bind('contextmenu', (evt) => {
        // Disable context menu
        evt.preventDefault();
    });
    
    function stateHover() {
        for(let h of hover){
            h.show();
        }
    }

    function stateNone() {
        for(let h of hover){
            h.hide();
        }
    }

    
    function animate() 
    {
        if(!active){
            currentRotation -=animationSpeed;
            if(currentRotation < -angle){
                currentRotation = -angle;
            }
        }
        else{
            currentRotation +=animationSpeed;
            if(currentRotation > angle){
                currentRotation = angle;
            }
        }        
        tRotate.setRotate(currentRotation, centerX, centerY);        
        if((currentRotation > -angle && currentRotation < angle)){
            animationID = requestAnimationFrame( animate );
        }        
    }
    
    that.refresh = function() {
        let value = that.$c.refresh_from.getValue();
        if (reverse_meaning) {            
            active = !value;
        }
        else {
            active = value;
        }
        if (!active) {
            if (tRotate) {                
                if(requestAnimationFrame){                    
                    animate();
                }   
                else{
                    tRotate.setRotate(-angle, centerX, centerY);
                }                             
            }
            else { // Deprecated
                hand.setAttributeNS(null, "transform", "rotate(" + (-1 * angle) + "," + centerX + "," + centerY + ")");
            }
            handTip.style.fill = labelColorFalse;
            textOn.style.fill = textOnDefaultFill;
            textOff.style.fill = labelColorFalse;
        }
        else {
            if (tRotate) {
                if(requestAnimationFrame){                    
                    animate();
                }   
                else{
                    tRotate.setRotate(angle, centerX, centerY);
                }                      
            }
            else { // Deprecated
                hand.setAttributeNS(null, "transform", "rotate(" + angle + "," + centerX + "," + centerY + ")");
            }
            handTip.style.fill = labelColorTrue;
            textOn.style.fill = labelColorTrue;
            textOff.style.fill = textOffDefaultFill;
        }        
        oldDate = new Date();
    };

    that.setReadOnly = function () {
        that.readOnly = true;
        stateNone();
        $switchArea.off().removeData();
        $switchArea.css('pointer-events', 'none');
    };

    var oldDisable = that.disable;
    that.disable = function () {
        oldDisable.apply(that, arguments);
        // if (tRotate) {
        //     tRotate.setRotate(0, centerX, centerY);
        // }
        // else { // Deprecated
        //     hand.setAttributeNS(null, "transform", "rotate(" + 0 + "," + centerX + "," + centerY + ")");
        // }
        // handTip.style.fill = that.COLORS.inactive;
        // textOn.style.fill = textOnDefaultFill;
        // textOff.style.fill = textOffDefaultFill;
        $switchArea.css('pointer-events', 'none');
        that.refresh();
    };

    var oldEnable = that.enable;
    that.enable = function () {
        if (oldEnable.apply(that, arguments)) {
            $switchArea.css('pointer-events', '');
            that.refresh();
        }
    };

    return that;
};

/**
 * SVG component represents OnOff switch.
 * @param {SVGElement} svgElem 
 * @param {Object} args It is possible to specify {type:"",svg:SVG_ELEMENT,defs:DEFS_ELEMENT} 
 * @returns {REX.UI.SVG.SwitchOnOff2} New SVG SwitchOnOff2 component
 */
REX.UI.SVG.SwitchOnOff2 = function (svgElem, args) {
    // Inherit from base component
    var that = new REX.UI.SVG.HTMLComponent(svgElem, args);
    var $o = that.options || {};
    var onMouseDownValue = that.parseBoolean($o.reverseMeaning) ? 0 : 1;

    // Add `write` and `refresh` functions. Necessary for all write components 
    // with *value* and  *refresh_from* items.
    that.addWriteInterface();

    var id = that.element.getAttributeNS(null, 'id');    
    $(that.div).addClass('SwitchOnOff2');

    // SVG text zustane viditelny, tak neni problem s jeho scalovanim
    // zatim lze pouze za switchem    
    $(that.element).find('text').css('visibility', 'visible');

    // HACK: Pri volani funkce update position se bude brat v potaz pouze pozice Switche ne labelu
    that.element = $(that.element).find('g')[0];

    that.div.innerHTML =
        `<div class="mdc-switch">
            <input type="checkbox" id="${id}-switch" class="mdc-switch__native-control" />
            <div class="mdc-switch__background">
                <div class="mdc-switch__knob"></div>
            </div>
        </div>`;
    //        <label for="${id}-switch" class="mdc-switch-label">${$o.label || ""}</label>`;
    let switchDiv = $(that.div).children().first();
    //switchDiv.css('transform-origin', 'top left');
    switchDiv.css('transform-origin', '0px -3.6px');

    var input = $(that.div).find('input');

    that.on('disable', (disable) => {
        if (disable) {
            input.attr("disabled", true);
            input.css('pointer-events', 'none');
            $(that.div).find('*').css('cursor', 'default');
        }
        else{
            input.removeAttr("disabled");
            input.css('pointer-events', '');
            $(that.div).find('*').css('cursor', '');
        }
    });

    that.on('updatePosition', (pos) => {
        let r;
        // Oprava pro DWM, kdyz ma SVG display:none, tak nejde spocitat getBBox()
        try {
            r = Math.min(pos.height / that.element.getBBox().height, pos.width / that.element.getBBox().width);
        } catch (error) {
            r = 1;
        }
        switchDiv.css('transform', `scale(${r.toFixed(4)})`);
    });

    let active = false;
    input.change(function (evt) {
        evt.preventDefault();
        if (active) {
            that.write(1 - onMouseDownValue);
        }
        else{
            that.write(onMouseDownValue);
        }
        $(this).blur();
    });

    that.refresh = function(){
        let value = that.items.refresh_from.getValue();
        if (value === (1 - onMouseDownValue)) {
            input.prop('checked', false);
            active = false;
        }
        else {
            input.prop('checked', true);
            active = true;
        }
    };

    that.setReadOnly = function () {
        input.css('pointer-events', 'none');
        input.off('change');
        $(that.div).find('*').css('cursor', 'default');
    };

    that.updatePosition();
    that.disable(true);    
    return that;
};