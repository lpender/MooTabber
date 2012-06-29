/*
    MooTools Plugin by Lee Pender

    Requires:
    MooTools

    Applies "selected" class to tabs (and optional unselected class) and hides/shows corresponding panes.

    use:

    HTML:

    <div class="tabber">
        <a id="slide1" class="tab">
        <a id="slide2" class="tab">
        <a id="slide3" class="tab">
    </div>
    <div id="pane-slide1">pane1</div>
    <div id="pane-slide2">pane2/div>
    <div id="pane-slide3">pane3</div>

    js:

     var tabbers = $$('.tabber');
     if(tabbers.length > 0) {
         tabbers.each(function(el) {
             new HG.Tabber(el);
         });
     }

     you may also have the panes created automatically by specifying a paneHolderId anda loadMode:

     i.e.
     <div class="tabber">
         <a id="slide1" href="/link1/" class="tab">
         <a id="slide2" href="/link2/" class="tab">
         <a id="slide3" href="/link3/" class="tab">
     </div>
     <div id="paneholder"></div>

     js:

     var tabbers = $$('.tabber');
         if(tabbers.length > 0) {
             tabbers.each(function(el) {
                new.HG.Tabber(el, {
                    paneHolderId: paneholder,
					loadMode: 'ajax',
					ajaxAttr: 'href'
                });
         });
     }

	if neither is specified, tabber will revert to tabs only mode and simply add the selected/unselected classes to the tabs

*/

MooTabber = new Class({

    Implements: [Events, Options],

    options: {
        duration: 0,                   // duration for slides to switch
        delay: 3000,				// delay between switching slides in autoplay mode
        selectedClass: 'selected',  //class to add to selected tab
        unselectedClass: null,      //class to add to unselected tab
        tabSelector: '.tab',        //selector to build array of tabs
        panePrefix: 'pane-',        //the prefix to add to panes
        initTab: undefined,              //defaults to the first tab :: can take either a number or an id
        displayValue: 'block',       //what to set panes to when they are shown, you may wish to use inline or inline-block
        loadMode: null,             // you may set this to "ajax" or "iframe" (iframe requires paneHolderId)
        urlAttr: 'href',           // attribute to use on the tab which determines url to fetch
        paneHolderId: false,           //pass full css selector of paneHolder
        testMode: false,            // set to true to see console log alerts
        selectParent: false,         // pass full css selector of parent to receive selected/unselected class
        nextBtn: '.next',
        prevBtn: '.prev',
        playPauseBtn: '.icon-playpause', //css selector for the play/pause button
        playingClass: 'playing',   //add this class to playPauseBtn when it's playing
        autoplay: false,
		mode: null,                 // set to 'slideshow' to give position: absolute to panes or 'tabs-only' to simply add selected/unselected classes
        step: false,					//set to true to wait until previous pane has faded out to fade in new pane
        hashMode : false                 //set to true to cause tabber to select a tab if it's href matches current hash
    },

    panes : [],
    tabs : [],
    paneHolder : null,
    tabber : null,
    currentTab: 0,
    interval: null,
    nextBtn: null,
    prevBtn: null,
    playPauseBtn: null,
    playing: false,
    EVENT_TAB_CLICK : 'tabClick',
    EVENT_COMPLETE : 'complete',

    initialize: function(tabContainer, options) {
        var instance = this;
        instance.trace('initalizing tabber');
        instance.setOptions(options);
        // If Tabber is an array, take the first in the array.
        if(tabContainer[0]) {
            instance.tabber = tabContainer[0];
        } else {
            instance.tabber = tabContainer;
        }
		if (instance.options.mode) {
			instance.mode = instance.options.mode;
		}
        instance.initPaneHolder();
        instance.initTabs();
        instance.initPanes();
        instance.setInitTab();
        instance.initBtns();
        instance.initAutoPlay();
        if (instance.options.hashMode) {
            window.addEvent('hashchange',function(newhash) {
                instance.hashLoad(newhash);
            });
            instance.hashLoad(window.location.hash);
        };
        instance.trace('Tabber Initialized');
    },

    initPaneHolder:function() {
        var instance = this;
        // if there is a paneHolder id, find reference to it or create it and inject it after tabber
        if (instance.options.paneHolderId) {
            //create reference to paneholder
            if ($(instance.options.paneHolderId)) {
                instance.paneHolder = $(instance.options.paneHolderId);
            } else {
                //or create a paneholder
                instance.paneHolder = new Element('div', {
                    id: instance.options.paneHolderId
                }).inject(instance.tabber, 'after')
            }
            instance.trace("paneHolder id is: " + instance.paneHolder.get('id'));
        }
    },

    initTabs : function() {
        var instance = this;
        // Populate Tabs Array
        instance.tabber.getElements(instance.options.tabSelector).each(function(tab, index) {
            instance.trace("tab " + index + " html is " + tab.get('html') + ' got using selector: ' + instance.options.tabSelector);
            tab.index = index;
            instance.tabs.push(tab);
        });
        instance.tabs.each(function(tab){
        	instance.trace('initializing tab ' + tab.index);
            instance.initTab(tab.index);
        });
    },

    initTab : function (tabIndex) {
        var instance = this;
        var tab = instance.tabs[tabIndex];
        if(tab.get('id') == null) {
            //tab.set('id', "tab-" + tabIndex);
        }
        tab.addEvent('click', function(event) {
            // Only set tab manually if not in hash mode
            if (!instance.options.hashMode){
                event.stop();
                instance.setTab(this.index);
            }
            // pause if a slideshow is playing and fire the call back
            instance.pause();
            instance.fireEvent(instance.EVENT_TAB_CLICK);
        });
    },

    setInitTab: function() {
        var instance = this;
        var initTabIndex = 0;
        if (!isNaN(instance.options.initTab)) {
            if (instance.tabs[instance.options.initTab])
            {
                initTabIndex = instance.options.initTab; // if initTab is a number, set it to the number
            }
        } else {
        	if(typeof instance.options.initTab !== 'undefined') {
	        	instance.tabs.each(function(tab) { 
	        		if(instance.options.initTab == tab.get('id')) {
	        			initTabIndex = tab.index;  // if it's an ID, set by the ID
	        		}
	        	});
        	}
        }
        instance.trace('Initial Tab set to: ' + instance.tabs[initTabIndex].get('html'));
        //set initial tab
        instance.setTab(initTabIndex);
    },

    initPanes : function () {
        var instance = this;
        //Populate Panes Array
        if(instance.options.mode == 'tabs-only' || instance.options.loadMode != 'iframe') {
            instance.tabs.each(function(tab) {
                instance.initPane(tab);
            });
        }
    },

    initPane : function (tab, content) {
        var instance = this;
        var paneId = instance.getPaneId(tab);
        var pane = undefined;
        if ($(paneId)){
            //if there is a paneId on page, push that to the panes array
            pane = $(paneId);
        } else {
            //otherwise create a div
            pane = new Element('div', {
                id: paneId,
                html: content
            });
            if (!instance.paneHolder) {
                instance.paneHolder = instance.panes[0].getParent();
            }
            pane.inject(instance.paneHolder, 'bottom');
        }
        pane.firstClick = false;
        pane.index = tab.index;
        if (instance.options.mode == 'slideshow') {
            pane.setStyles({
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0
            });
        }
        pane.hide();
        instance.panes.push(pane);
    },

    setTab : function (tabIndex) {
        var instance = this;
        instance.resetTabs();
        instance.trace("setting tab: " + instance.tabs[tabIndex].get('html'));
        var tab = instance.tabs[tabIndex];
        if(instance.options.selectParent) {
            if (instance.options.selectParent instanceof String) {
                tab.getParent(instance.options.selectParent).addClass(instance.options.selectedClass);
            } else {
                tab.getParent().addClass(instance.options.selectedClass);
            }
        } else {
            tab.addClass(instance.options.selectedClass);
        }
		if (instance.options.mode != 'tabs-only' && instance.options.loadMode != 'iframe') {
	        instance.setPane($(instance.getPaneId(tab)));
		} else if (instance.options.loadMode == 'iframe') {
            instance.paneHolder.set('src', tab.get(instance.options.urlAttr));
            instance.paneHolder.set('data-src', tab.get(instance.options.urlAttr));
        }
        instance.currentTab = tabIndex;
    },

    getCurrentTab : function(){
        var instance = this;
        return instance.tabs[instance.currentTab];
    },

    resetTabs : function () {
        var instance = this;
        instance.tabs.each(function(tab) {
            var tabToReset = null;
            //select correct tab to reset
            if (instance.options.selectParent) {
                if(instance.options.selectParent instanceof String) {
                    tabToReset = tab.getParent(instance.options.selectParent);
                } else {
                    tabToReset = tab.getParent();
                }
            } else {
                tabToReset = tab;
            }
            //reset tabs
            if(tabToReset.hasClass(instance.options.selectedClass)) {
                tabToReset.removeClass(instance.options.selectedClass);
            }
            if(instance.options.unselectedClass && !tab.hasClass(instance.options.unselectedClass)) {
                tabToReset.addClass(instance.options.unselectedClass);
            }
        })
    },

    setPane:function (pane) {
        var instance = this;
        if (instance.currentTab == pane.index) {
        	pane.setStyle('opacity', 1);
			pane.setStyle('display', instance.options.displayValue);
        } else {
	        instance.hidePane(instance.currentTab);
        	var myFx = new Fx.Tween(pane, {property: 'opacity', duration: instance.options.duration});
			pane.setStyle('display', instance.options.displayValue);
        	myFx.start(1);
        }
        if(!pane.firstClick) {
            if(instance.options.loadMode === 'ajax') {
                instance.trace('setting pane via ajax: ' + pane.get('id'));
                var urlRequest = instance.getTab(pane).get(instance.options.urlAttr);
                instance.trace('sending url ' + urlRequest);
                new Request({
                    url : urlRequest,
                    onComplete: function(result){
                            pane.set('html', result);
                        }
                }).send();
            }
            pane.firstClick = true;
        }
        instance.fireEvent(instance.EVENT_COMPLETE);
    },

    hidePane:function(paneIndex) {
        var instance = this;
        var pane = instance.panes[paneIndex];
    	var myFx = new Fx.Tween(pane, {property: 'opacity', duration: instance.options.duration});
    	myFx.start(0).chain(function() {
			if(instance.options.mode != 'slideshow'){
                pane.setStyle('display', 'none');
            }
		});
    },

    getPaneId : function(tab) {
        return (this.options.panePrefix + tab.get('id'));
    },

    getTabId: function(pane) {
      return (pane.get('id').replace(this.options.panePrefix, ''));
    },

    getPane : function(tab) {
        return this.panes[tab.index];
    },

    getTab : function(pane) {
        return this.tabs[pane.index];
    },

    addTab: function(content, separator, id, paneContent, label, href, elementType) {
        var instance = this,
            content = (typeof content == 'undefined') ? '' : content,
            paneContent = (typeof paneContent == 'undefined') ? '' : paneContent,
            separator = (typeof separator == 'undefined') ? '' : separator,
            id = (typeof id == 'undefined') ? ((content != '') ? 'tab-' + content.replace(' ', '-') : 'tab-' + instance.tabs.length) : id,
            label = (typeof label == 'undefined') ? '' : label,
            elementType = (typeof elementType == 'undefined') ? (instance.tabs[0].get('tag') ? instance.tabs[0].get('tag') : 'div') : elementType,
            href = (typeof href == 'undefined') ? '' : href;

        instance.trace('creating a new element with id: ' + id + " label = " + label + " content : " + content + " elementType: " + elementType );
        var newTab = new Element(elementType, {
            id: id,
            label: label,
            html: content,
            href: href
        }).inject(instance.tabber, "bottom");
        newTab.index = instance.tabs.length;
        instance.tabs.push(newTab);
        instance.initTab(newTab.index);
        instance.initPane(newTab, paneContent);
    },
    
    initBtns: function() {
    	var instance = this;
    	instance.prevBtn = instance.tabber.getElements(instance.options.prevBtn);
    	instance.nextBtn = instance.tabber.getElements(instance.options.nextBtn);
        instance.playPauseBtn = instance.tabber.getElements(instance.options.playPauseBtn);
        if (instance.prevBtn.length > 0) {
        	instance.prevBtn.addEvent('click', function() {
        		instance.goBack();
                instance.pause();
        	});
        }
        if (instance.nextBtn) {
            instance.nextBtn.addEvent('click', function() {
        		instance.goForward();
                instance.pause();
        	});
        }
        if (instance.playPauseBtn) {
            instance.playPauseBtn.addEvent('click', function() {
                instance.playPause();
            })
        }
    },
    
    initAutoPlay: function () { 
    	var instance = this;
    	if(instance.options.autoplay) {
    		window.addEvent('load', function(){
    			instance.play();
    		});
    	}
    },

    play: function() {
        var instance = this;
        instance.interval = instance.goForward.periodical(instance.options.delay, instance);
        instance.playing = true;
        if(instance.playPauseBtn) {
            instance.playPauseBtn.addClass(instance.options.playingClass);
        }
    },

    pause: function() {
        var instance = this;
        $clear(instance.interval);
        instance.playing = false;
        if(instance.playPauseBtn) {
            instance.playPauseBtn.removeClass(instance.options.playingClass);
        }
    },

    playPause: function() {
        var instance = this;
        if (instance.playing) {
            instance.pause();
        } else {
            instance.play();
        }
    },
    
    goForward: function() {
    	var instance = this;
    	instance.trace('going forward');
    	var newIndex = instance.currentTab;
    	if(newIndex == instance.tabs.length -1) {
    		newIndex = 0;
    	} else {
    		newIndex++;
    	}
    	instance.setTab(newIndex);
    	instance.currentTab = newIndex;
    },
    
    goBack: function() {
    	var instance = this;
    	instance.trace('going back');
    	var newIndex = instance.currentTab;
    	if(newIndex == 0) {
    		newIndex = instance.tabs.length - 1;
    	} else {
    		newIndex--;
    	}
    	instance.setTab(newIndex);
    	instance.currentTab = newIndex;
    },

    hashLoad : function(hash) {
        var instance = this;
        instance.tabs.each(function(el,index) {
           if(el.get('href') == hash) {
               instance.setTab(index);
           }
        });
    },
    trace: function(s) {
        var instance = this;
        if (instance.options.testMode) {
            if (console.log) {
                console.log(s);
            }
        }
    }
});
