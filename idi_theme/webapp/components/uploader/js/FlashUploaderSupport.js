/*
Copyright 2008-2009 University of Toronto
Copyright 2008-2009 University of California, Berkeley
Copyright 2010-2011 OCAD University

Licensed under the Educational Community License (ECL), Version 2.0 or the New
BSD license. You may not use this file except in compliance with one these
Licenses.

You may obtain a copy of the ECL 2.0 License and BSD License at
https://github.com/fluid-project/infusion/raw/master/Infusion-LICENSE.txt
*/

// Declare dependencies
/*global fluid_1_4:true, jQuery, swfobject, SWFUpload */

// JSLint options 
/*jslint white: true, funcinvoke: true, undef: true, newcap: true, nomen: true, regexp: true, bitwise: true, browser: true, forin: true, maxerr: 100, indent: 4 */

var fluid_1_4 = fluid_1_4 || {};

(function ($, fluid) {

    fluid.uploader = fluid.uploader || {};
    
    fluid.demands("fluid.uploaderImpl", "fluid.uploader.swfUpload", {
        funcName: "fluid.uploader.multiFileUploader"
    });
    
    /**********************
     * uploader.swfUpload *
     **********************/
    
    fluid.uploader.swfUploadStrategy = function (options) {
        var that = fluid.initLittleComponent("fluid.uploader.swfUploadStrategy", options);
        fluid.initDependents(that);
        return that;
    };
    
    fluid.defaults("fluid.uploader.swfUploadStrategy", {
        components: {
            engine: {
                type: "fluid.uploader.swfUploadStrategy.engine",
                options: {
                    queueSettings: "{multiFileUploader}.options.queueSettings",
                    flashMovieSettings: "{swfUploadStrategy}.options.flashMovieSettings"
                }
            },
            
            local: {
                type: "fluid.uploader.local",
                options: {
                    errorHandler: "{multiFileUploader}.dom.errorHandler"
                }
            },
            
            remote: {
                type: "fluid.uploader.remote"
            }
        },
        
        // TODO: Rename this to "flashSettings" and remove the "flash" prefix from each option
        flashMovieSettings: {
            flashURL: "../../../lib/swfupload/flash/swfupload.swf",
            flashButtonPeerId: "",
            flashButtonAlwaysVisible: false,
            flashButtonTransparentEvenInIE: true,
            flashButtonImageURL: "../images/browse.png", // Used only when the Flash movie is visible.
            flashButtonCursorEffect: SWFUpload.CURSOR.HAND,
            debug: false
        },

        styles: {
            browseButtonOverlay: "fl-uploader-browse-overlay",
            flash9Container: "fl-uploader-flash9-container",
            uploaderWrapperFlash10: "fl-uploader-flash10-wrapper"
        }
    });
    
    fluid.demands("fluid.uploader.progressiveStrategy", "fluid.uploader.swfUpload", {
        funcName: "fluid.uploader.swfUploadStrategy"
    });
    
    
    fluid.uploader.swfUploadStrategy.remote = function (swfUpload, queue, options) {
        var that = fluid.initLittleComponent("fluid.uploader.swfUploadStrategy.remote", options);
        that.swfUpload = swfUpload;
        that.queue = queue;
        
        that.uploadNextFile = function () {
            that.swfUpload.startUpload();
        };
        
        that.stop = function () {
            // FLUID-822: Instead of actually stopping SWFUpload right away, we wait until the current file 
            // is finished and then don't bother to upload any new ones. This is due an issue where SWFUpload
            // appears to hang while Uploading a file that was previously stopped. I have a lingering suspicion
            // that this may actually be a bug in our Image Gallery demo, rather than in SWFUpload itself.
            that.queue.shouldStop = true;
        };
        return that;
    };
    
    fluid.demands("fluid.uploader.remote", "fluid.uploader.swfUploadStrategy", {
        funcName: "fluid.uploader.swfUploadStrategy.remote",
        args: [
            "{engine}.swfUpload",
            "{multiFileUploader}.queue",
            "{options}"
        ]
    });

    
    fluid.uploader.swfUploadStrategy.local = function (swfUpload, options) {
        var that = fluid.initLittleComponent("fluid.uploader.swfUploadStrategy.local", options);
        that.swfUpload = swfUpload;
        
        that.browse = function () {
            if (that.options.file_queue_limit === 1) {
                that.swfUpload.selectFile();
            } else {
                that.swfUpload.selectFiles();
            }    
        };
        
        that.removeFile = function (file) {
            that.swfUpload.cancelUpload(file.id);
        };
        
        that.enableBrowseButton = function () {
            that.swfUpload.setButtonDisabled(false);
        };
        
        that.disableBrowseButton = function () {
            that.swfUpload.setButtonDisabled(true);
        };
        
        return that;
    };
    
    fluid.demands("fluid.uploader.local", "fluid.uploader.swfUploadStrategy", {
        funcName: "fluid.uploader.swfUploadStrategy.local",
        args: [
            "{engine}.swfUpload",
            "{options}"
        ]
    });
    
    fluid.uploader.swfUploadStrategy.engine = function (options) {
        var that = fluid.initLittleComponent("fluid.uploader.swfUploadStrategy.engine", options);
        
        // Get the Flash version from swfobject and setup a new context so that the appropriate
        // Flash 9/10 strategies are selected.
        var flashVersion = swfobject.getFlashPlayerVersion().major;
        that.flashVersionContext = fluid.typeTag("fluid.uploader.flash." + flashVersion);
        
        // Merge Uploader's generic queue options with our Flash-specific options.
        that.config = $.extend({}, that.options.queueSettings, that.options.flashMovieSettings);
        
        // Configure the SWFUpload subsystem.
        fluid.initDependents(that);
        that.flashContainer = that.setupDOM();
        that.swfUploadConfig = that.setupConfig();
        that.swfUpload = new SWFUpload(that.swfUploadConfig);
        that.bindEvents();
        
        return that;
    };
    
    fluid.defaults("fluid.uploader.swfUploadStrategy.engine", {
        invokers: {
            setupDOM: "fluid.uploader.swfUploadStrategy.setupDOM",
            setupConfig: "fluid.uploader.swfUploadStrategy.setupConfig",
            bindEvents: "fluid.uploader.swfUploadStrategy.eventBinder"
        }
    });
    
    fluid.demands("fluid.uploader.swfUploadStrategy.engine", "fluid.uploader.swfUploadStrategy", {
        funcName: "fluid.uploader.swfUploadStrategy.engine",
        args: [
            fluid.COMPONENT_OPTIONS
        ]
    });
    

    /*
     * Transform HTML5 MIME types into file types for SWFUpload.
     */
    fluid.uploader.swfUploadStrategy.fileTypeTransformer = function (model, expandSpec) { 
        var fileExts = "";
        var mimeTypes = fluid.get(model, expandSpec.path); 
        var mimeTypesMap = fluid.uploader.mimeTypeRegistry;
        
        if (!mimeTypes) {
            return "*";
        } else if (typeof (mimeTypes) === "string") {
            return mimeTypes;
        }
        
        fluid.each(mimeTypes, function (mimeType) {
            fluid.each(mimeTypesMap, function (mimeTypeForExt, ext) {
                if (mimeTypeForExt === mimeType) {
                    fileExts += "*." + ext + ";";
                }
            });
        });

        return fileExts.length === 0 ? "*" : fileExts.substring(0, fileExts.length - 1);
    };
    
    /**********************
     * swfUpload.setupDOM *
     **********************/
    
    fluid.uploader.swfUploadStrategy.flash10SetupDOM = function (uploaderContainer, browseButton, progressBar, styles) {
        // Wrap the whole uploader first.
        uploaderContainer.wrap("<div class='" + styles.uploaderWrapperFlash10 + "'></div>");

        // Then create a container and placeholder for the Flash movie as a sibling to the uploader.
        var flashContainer = $("<div><span></span></div>");
        flashContainer.addClass(styles.browseButtonOverlay);
        uploaderContainer.after(flashContainer);
        progressBar.append(flashContainer);
        browseButton.attr("tabindex", -1);        
        return flashContainer;   
    };
    
    fluid.demands("fluid.uploader.swfUploadStrategy.setupDOM", [
        "fluid.uploader.swfUploadStrategy.engine",
        "fluid.uploader.flash.10"
    ], {
        funcName: "fluid.uploader.swfUploadStrategy.flash10SetupDOM",
        args: [            
            "{multiFileUploader}.container",
            "{multiFileUploader}.dom.browseButton",
            "{totalProgress}.dom.progressBar",
            "{swfUploadStrategy}.options.styles"
        ]
    });
     
     
    /*********************************
     * swfUpload.setupConfig *
     *********************************/
      
    // Maps SWFUpload's setting names to our component's setting names.
    var swfUploadOptionsMap = {
        uploadURL: "upload_url",
        flashURL: "flash_url",
        postParams: "post_params",
        fileSizeLimit: "file_size_limit",
        fileTypes: "file_types",
        fileUploadLimit: "file_upload_limit",
        fileQueueLimit: "file_queue_limit",
        flashButtonPeerId: "button_placeholder_id",
        flashButtonImageURL: "button_image_url",
        flashButtonHeight: "button_height",
        flashButtonWidth: "button_width",
        flashButtonWindowMode: "button_window_mode",
        flashButtonCursorEffect: "button_cursor",
        debug: "debug"
    };

    // Maps SWFUpload's callback names to our component's callback names.
    var swfUploadEventMap = {
        afterReady: "swfupload_loaded_handler",
        onFileDialog: "file_dialog_start_handler",
        onFileQueued: "file_queued_handler",        
        onQueueError: "file_queue_error_handler",
        afterFileDialog: "file_dialog_complete_handler",
        onFileStart: "upload_start_handler",
        onFileProgress: "upload_progress_handler",
        onFileComplete: "upload_complete_handler",
        onFileError: "upload_error_handler",
        onFileSuccess: "upload_success_handler"
    };
    
    var mapNames = function (nameMap, source, target) {
        var result = target || {};
        for (var key in source) {
            var mappedKey = nameMap[key];
            if (mappedKey) {
                result[mappedKey] = source[key];
            }
        }
        
        return result;
    };
    
    // For each event type, hand the fire function to SWFUpload so it can fire the event at the right time for us.
    // TODO: Refactor out duplication with mapNames()--should be able to use Engage's mapping tool
    var mapSWFUploadEvents = function (nameMap, events, target) {
        var result = target || {};
        for (var eventType in events) {
            var fireFn = events[eventType].fire;
            var mappedName = nameMap[eventType];
            if (mappedName) {
                result[mappedName] = fireFn;
            }   
        }
        return result;
    };
    
    fluid.uploader.swfUploadStrategy.convertConfigForSWFUpload = function (flashContainer, config, events, queueSettings) {
        config.flashButtonPeerId = fluid.allocateSimpleId(flashContainer.children().eq(0));
        // Map the event and settings names to SWFUpload's expectations.
        // Convert HTML5 MIME types into SWFUpload file types
        config.fileTypes = fluid.uploader.swfUploadStrategy.fileTypeTransformer(queueSettings, {
            path: "fileTypes"
        });
        var convertedConfig = mapNames(swfUploadOptionsMap, config);
        // TODO:  Same with the FLUID-3886 branch:  Can these declarations be done elsewhere?
        convertedConfig.file_upload_limit = 0;
        convertedConfig.file_size_limit = 0;
        return mapSWFUploadEvents(swfUploadEventMap, events, convertedConfig);
    };
    
    fluid.uploader.swfUploadStrategy.flash10SetupConfig = function (config, events, flashContainer, browseButton, queueSettings) {
        var isTransparent = config.flashButtonAlwaysVisible ? false : (!$.browser.msie || config.flashButtonTransparentEvenInIE);
        config.flashButtonImageURL = isTransparent ? undefined : config.flashButtonImageURL;
        config.flashButtonHeight = config.flashButtonHeight || browseButton.outerHeight();
        config.flashButtonWidth = config.flashButtonWidth || browseButton.outerWidth();
        config.flashButtonWindowMode = isTransparent ? SWFUpload.WINDOW_MODE.TRANSPARENT : SWFUpload.WINDOW_MODE.OPAQUE;
        return fluid.uploader.swfUploadStrategy.convertConfigForSWFUpload(flashContainer, config, events, queueSettings);
    };
    
    fluid.demands("fluid.uploader.swfUploadStrategy.setupConfig", [
        "fluid.uploader.swfUploadStrategy.engine",
        "fluid.uploader.flash.10"
    ], {
        funcName: "fluid.uploader.swfUploadStrategy.flash10SetupConfig",
        args: [
            "{engine}.config",
            "{multiFileUploader}.events",
            "{engine}.flashContainer",
            "{multiFileUploader}.dom.browseButton",
            "{multiFileUploader}.options.queueSettings"
        ]
    });

     
    /*********************************
     * swfUpload.eventBinder *
     *********************************/
     
    var unbindSWFUploadSelectFiles = function () {
        // There's a bug in SWFUpload 2.2.0b3 that causes the entire browser to crash 
        // if selectFile() or selectFiles() is invoked. Remove them so no one will accidently crash their browser.
        var emptyFunction = function () {};
        SWFUpload.prototype.selectFile = emptyFunction;
        SWFUpload.prototype.selectFiles = emptyFunction;
    };
    
    fluid.uploader.swfUploadStrategy.bindFileEventListeners = function (model, events) {
        // Manually update our public model to keep it in sync with SWFUpload's insane,
        // always-changing references to its internal model.        
        var manualModelUpdater = function (file) {
            fluid.find(model, function (potentialMatch) {
                if (potentialMatch.id === file.id) {
                    potentialMatch.filestatus = file.filestatus;
                    return true;
                }
            });
        };
        
        events.onFileStart.addListener(manualModelUpdater);
        events.onFileProgress.addListener(manualModelUpdater);
        events.onFileError.addListener(manualModelUpdater);
        events.onFileSuccess.addListener(manualModelUpdater);
    };
    
    var filterErroredFiles = function (file, events, queue, queueSettings) {
        var fileSizeLimit = queueSettings.fileSizeLimit * 1000;
        var fileUploadLimit = queueSettings.fileUploadLimit;
        var processedFiles = queue.getReadyFiles().length + queue.getUploadedFiles().length; 

        if (file.size > fileSizeLimit) {
            file.filestatus = fluid.uploader.fileStatusConstants.ERROR;
            events.onQueueError.fire(file, fluid.uploader.queueErrorConstants.FILE_EXCEEDS_SIZE_LIMIT);
        } else if (processedFiles >= fileUploadLimit) {
            events.onQueueError.fire(file, fluid.uploader.queueErrorConstants.QUEUE_LIMIT_EXCEEDED);
        } else {
            events.afterFileQueued.fire(file);
        }
    };
    
    fluid.uploader.swfUploadStrategy.flash10EventBinder = function (queue, queueSettings, events) {
        var model = queue.files;
        unbindSWFUploadSelectFiles();      
              
        events.onFileQueued.addListener(function (file) {
            filterErroredFiles(file, events, queue, queueSettings);
        });        
        
        fluid.uploader.swfUploadStrategy.bindFileEventListeners(model, events);
    };
    
    fluid.demands("fluid.uploader.swfUploadStrategy.eventBinder", [
        "fluid.uploader.swfUploadStrategy.engine",
        "fluid.uploader.flash.10"
    ], {
        funcName: "fluid.uploader.swfUploadStrategy.flash10EventBinder",
        args: [
            "{multiFileUploader}.queue",
            "{multiFileUploader}.queue.files",
            "{multiFileUploader}.events"
        ]
    });
})(jQuery, fluid_1_4);
