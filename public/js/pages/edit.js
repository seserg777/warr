$(function()
{
    $(document).on('click', '.btn-add', function(e)
    {
        e.preventDefault();

        var controlForm = $(this).parents('.controls:first'),
            currentEntry = $(this).parents('.entry:first'),
            newEntry = $(currentEntry.clone()).appendTo(controlForm);

        newEntry.find('input').val('');
        controlForm.find('.entry:not(:last) .btn-add')
            .removeClass('btn-add').addClass('btn-remove')
            .removeClass('btn-success').addClass('btn-danger')
            .html('<span class="fa fa-minus"></span>');
    }).on('click', '.btn-add-list', function(e)
    {
        e.preventDefault();

        var controlForm = $(this).parents('.controls:first'),
            currentEntry = $(this).parents('.entry:first'),
            newEntry = $(currentEntry.clone()).appendTo(controlForm);

        newEntry.find('input').val('');
        controlForm.find('.entry:not(:last) .btn-add-list')
            .removeClass('btn-add-list').addClass('btn-remove-list')
            .removeClass('btn-success').addClass('btn-danger')
            .html('<span class="fa fa-minus"></span>');
    }).on('click', '.btn-remove', function(e)
    {
        var serv_id = $(this).parents('.entry:first').find('input').attr('name');
        var newInput = document.createElement("input");
        newInput.type="hidden";
        newInput.name="delete[]";
        newInput.value = serv_id;
        $(newInput).insertAfter('[name="gid"]');
        //console.log(serv_id);
        $(this).parents('.entry:first').remove();

        e.preventDefault();
        return false;
    }).on('click', '.btn-remove-list', function(e)
    {
        //console.log(serv_id);
        $(this).parents('.entry:first').remove();

        e.preventDefault();
        return false;
    });


    var addFormGroup = function (event) {
        event.preventDefault();

        var $formGroup = $(this).closest('.form-group');
        var $multipleFormGroup = $formGroup.closest('.multiple-form-group');
        var $formGroupClone = $formGroup.clone();
        var $modal = $formGroupClone.find('.modal');
        var newInc = $('.multiple-form-group').length+1;

        $modal.attr('id','myModal'+newInc);
        $modal.find('.custom_field').attr('name','custom_fields['+newInc+'][list][]');
        $formGroupClone.find('.field-name').attr('name','custom_fields['+newInc+'][name]');
        $formGroupClone.find('.field-type').attr('name','custom_fields['+newInc+'][ftype]');
        $formGroupClone.find('.btn-list-cf').attr('data-target','#myModal'+newInc);
        $modal.find('.btn-remove').parents('.entry.input-group').remove();
        $modal.find('input').val('');
        $(this)
            .toggleClass('btn-success btn-add-cf btn-danger btn-remove-cf')
            .html('<span class="fa fa-minus"></span>');

        $formGroupClone.find('input').val('');

        $formGroupClone.find('.concept').text($formGroupClone.find(".dropdown-menu a:eq(0)").text());
        $formGroupClone.insertAfter($formGroup);
        $formGroupClone.find('.btn-list-cf').hide();
        var $lastFormGroupLast = $multipleFormGroup.find('.form-group:last');
        if ($multipleFormGroup.data('max') <= countFormGroup($multipleFormGroup)) {
            $lastFormGroupLast.find('.btn-add-cf').attr('disabled', true);
        }
    };

    var removeFormGroup = function (event) {
        event.preventDefault();

        var $formGroup = $(this).closest('.form-group');
        var $multipleFormGroup = $formGroup.closest('.multiple-form-group');

        var $lastFormGroupLast = $multipleFormGroup.find('.form-group:last');
        if ($multipleFormGroup.data('max') >= countFormGroup($multipleFormGroup)) {
            $lastFormGroupLast.find('.btn-add-cf').attr('disabled', false);
        }
        var elm_id = $multipleFormGroup.data('id');
        var newInput = document.createElement("input");
        newInput.type="hidden";
        newInput.name="delete[]";
        newInput.value = elm_id;
        $(newInput).insertAfter('[name="gid"]');
        $formGroup.remove();
    };

    var selectFormGroup = function (event) {
        event.preventDefault();

        var $selectGroup = $(this).closest('.input-group-select');
        var param = $(this).attr("href").replace("#","");
        var concept = $(this).text();
        if(param == "list") {
            $(this).closest('.form-group').find('.btn-list-cf').show();
        } else {
            $(this).closest('.form-group').find('.btn-list-cf').hide();
        }

        $selectGroup.find('.concept').text(concept);
        $selectGroup.find('.input-group-select-val').val(param);

    };

    var editFormGroup = function (event) {
        alert('ok');
    };

    var countFormGroup = function ($form) {
        return $form.find('.form-group').length;
    };

    var init_page = function() {
        $('.multiple-form-group').each(function(idx, elm) {
            $(elm).find('.dropdown-cf a.'+$(elm).find('.field-type').val()+'DropDown').click();
        });
    };

    $(document).on('click', '.btn-add-cf', addFormGroup);
    //$(document).on('click', '.btn-list-cf', editFormGroup);
    $(document).on('click', '.btn-remove-cf', removeFormGroup);
    $(document).on('click', '.dropdown-menu.dropdown-cf a', selectFormGroup);
    $(document).on('load', '.dropdown-menu.dropdown-cf a', selectFormGroup);
   // $(document).on('load',init_page);
    $(document).ready(function() {
        if($('#summernote').length>0)
            $('#summernote').summernote({height: 200});
    });

    init_page();
    $('#pageTabs a').click(function (e) {
        e.preventDefault();
        $(this).tab('show');
    });
});
